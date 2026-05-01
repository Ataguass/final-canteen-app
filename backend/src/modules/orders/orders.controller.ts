import { OrderStatus, PaymentMethod, PaymentStatus, StockMovementType } from "@prisma/client";
import { Request, Response } from "express";
import { prisma } from "../../config/database.js";
import { getIo } from "../../config/socket.js";
import { AppError } from "../../utils/appError.js";

type CreateOrderItemInput = {
  menuItemId: string;
  quantity: number;
  note?: string;
};

type CreateOrderInput = {
  items: CreateOrderItemInput[];
  paymentMethod?: PaymentMethod;
  paymentStatus?: PaymentStatus;
};

const nextOrderNumber = async (): Promise<string> => {
  const today = new Date().getFullYear();
  const count = await prisma.order.count();
  const seq = String(count + 1).padStart(4, "0");
  return `ORD-${today}-${seq}`;
};

const createOrder = async (
  tenantId: string,
  userId: string | undefined,
  payload: CreateOrderInput
) => {
  const { items, paymentMethod = PaymentMethod.CASH, paymentStatus = PaymentStatus.UNPAID } = payload;
  if (!items?.length) {
    throw new AppError("At least one item is required", 400);
  }

  const menuItems = await prisma.menuItem.findMany({
    where: { tenantId, id: { in: items.map((i) => i.menuItemId) } }
  });

  if (menuItems.length !== items.length) {
    throw new AppError("One or more menu items are invalid", 400);
  }

  const hasInvalidQuantity = items.some((item) => item.quantity <= 0);
  if (hasInvalidQuantity) {
    throw new AppError("All quantities must be greater than 0", 400);
  }

  const outOfStock = items.find((input) => {
    const menu = menuItems.find((m) => m.id === input.menuItemId);
    return !menu || menu.stockQty < input.quantity;
  });
  if (outOfStock) {
    throw new AppError("One or more items are out of stock", 400);
  }

  const subtotal = items.reduce((sum, input) => {
    const menu = menuItems.find((m) => m.id === input.menuItemId);
    return sum + (menu?.price ?? 0) * input.quantity;
  }, 0);

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  const taxAmount = tenant ? (subtotal * tenant.taxPercent) / 100 : 0;
  const totalAmount = subtotal + taxAmount;

  const created = await prisma.order.create({
    data: {
      tenantId,
      userId,
      orderNumber: await nextOrderNumber(),
      status: OrderStatus.PENDING,
      subtotal,
      taxAmount,
      totalAmount,
      paymentMethod,
      paymentStatus,
      items: {
        create: items.map((input) => {
          const menu = menuItems.find((m) => m.id === input.menuItemId)!;
          return {
            menuItemId: input.menuItemId,
            name: menu.name,
            price: menu.price,
            quantity: input.quantity,
            note: input.note
          };
        })
      }
    },
    include: { items: true }
  });

  const quantityByItem = items.reduce<Record<string, number>>((acc, input) => {
    acc[input.menuItemId] = (acc[input.menuItemId] ?? 0) + input.quantity;
    return acc;
  }, {});

  await Promise.all(
    Object.entries(quantityByItem).map(async ([menuItemId, quantity]) => {
      const menu = menuItems.find((entry) => entry.id === menuItemId);
      if (!menu) return;

      const previousQty = menu.stockQty;
      const newQty = Math.max(previousQty - quantity, 0);

      await prisma.menuItem.update({
        where: { id: menuItemId },
        data: { stockQty: { decrement: quantity } }
      });

      await prisma.stockMovement.create({
        data: {
          tenantId,
          menuItemId,
          actorUserId: userId,
          changeType: StockMovementType.SALE,
          delta: -quantity,
          previousQty,
          newQty,
          note: `Auto deduction from order ${created.orderNumber}`
        }
      });
    })
  );

  return created;
};

const emitOrderEvents = (order: Awaited<ReturnType<typeof createOrder>>) => {
  const io = getIo();
  io.emit("order:new", order);
  io.emit("kds:order_new", order);
  io.to(`tenant:${order.tenantId}`).emit("order:new", order);
  if (order.userId) {
    io.to(`user:${order.userId}`).emit("order:new", order);
  }
};

export const placeOrder = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId as string;
  const userId = req.user?.sub;
  const order = await createOrder(tenantId, userId, req.body as CreateOrderInput);
  emitOrderEvents(order);

  res.status(201).json({ success: true, data: order });
};

export const listOrders = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId as string;
  const role = req.user?.role;
  const userId = req.user?.sub;

  const orders = await prisma.order.findMany({
    where: {
      tenantId,
      ...(role === "ADMIN" || role === "SUPER_ADMIN" ? {} : { userId })
    },
    include: { items: true },
    orderBy: { createdAt: "desc" },
    take: 100
  });

  res.status(200).json({ success: true, data: orders });
};

export const getOrderById = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId as string;
  const role = req.user?.role;
  const userId = req.user?.sub;
  const { id } = req.params;

  const order = await prisma.order.findFirst({
    where: {
      id,
      tenantId,
      ...(role === "ADMIN" || role === "SUPER_ADMIN" ? {} : { userId })
    },
    include: { items: true }
  });

  if (!order) {
    throw new AppError("Order not found", 404);
  }

  res.status(200).json({ success: true, data: order });
};

export const updateOrderStatus = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { status } = req.body as { status: OrderStatus };

  if (!status) {
    throw new AppError("status is required", 400);
  }

  const order = await prisma.order.update({
    where: { id },
    data: { status },
    include: { items: true }
  });

  const io = getIo();
  io.emit("order:status_changed", order);
  io.to(`tenant:${order.tenantId}`).emit("order:status_changed", order);
  if (order.userId) {
    io.to(`user:${order.userId}`).emit("order:status_changed", order);
  }
  res.status(200).json({ success: true, data: order });
};

export const syncOrders = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId as string;
  const userId = req.user?.sub;
  const { orders } = req.body as { orders: CreateOrderInput[] };

  if (!Array.isArray(orders) || orders.length === 0) {
    throw new AppError("orders array is required", 400);
  }

  const created = [];
  for (const input of orders) {
    const order = await createOrder(tenantId, userId, input);
    emitOrderEvents(order);
    created.push(order);
  }

  res.status(201).json({ success: true, data: created });
};
