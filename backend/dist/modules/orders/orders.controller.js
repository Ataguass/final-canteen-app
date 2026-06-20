import { OrderStatus, PaymentMethod, PaymentStatus, StockMovementType, WalletTransactionType } from "@prisma/client";
import { Expo } from "expo-server-sdk";
import { prisma } from "../../config/database.js";
import { getIo } from "../../config/socket.js";
import { AppError } from "../../utils/appError.js";
const REGULAR_LANE = "REGULAR";
const TEACHER_PRIORITY_LANE = "TEACHER_PRIORITY";
const ADMIN_ROLES = new Set(["ADMIN", "SUPER_ADMIN"]);
const WALLET_POS_ALLOWED_ROLES = new Set(["TEACHER", "STAFF"]);
const formatSlotTime = (value) => value.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
const parsePickupSlot = (payload) => {
    const wantsSlot = Boolean(payload.isPreOrder || payload.pickupSlotLabel || payload.pickupSlotStart || payload.pickupSlotEnd);
    if (!wantsSlot) {
        return {
            isPreOrder: false,
            pickupSlotLabel: null,
            pickupSlotStart: null,
            pickupSlotEnd: null
        };
    }
    if (!payload.pickupSlotStart || !payload.pickupSlotEnd) {
        throw new AppError("pickupSlotStart and pickupSlotEnd are required for pre-order", 400);
    }
    const start = new Date(payload.pickupSlotStart);
    const end = new Date(payload.pickupSlotEnd);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        throw new AppError("Invalid pre-order slot dates", 400);
    }
    const now = new Date();
    if (start.getTime() <= now.getTime()) {
        throw new AppError("Pre-order pickup slot must be in the future", 400);
    }
    if (end.getTime() <= start.getTime()) {
        throw new AppError("pickupSlotEnd must be after pickupSlotStart", 400);
    }
    if (end.getTime() - start.getTime() > 2 * 60 * 60 * 1000) {
        throw new AppError("Pre-order pickup slot cannot exceed 2 hours", 400);
    }
    const label = payload.pickupSlotLabel?.trim() || `${formatSlotTime(start)} - ${formatSlotTime(end)}`;
    return {
        isPreOrder: true,
        pickupSlotLabel: label,
        pickupSlotStart: start,
        pickupSlotEnd: end
    };
};
const nextOrderNumber = async () => {
    const today = new Date().getFullYear();
    const count = await prisma.order.count();
    const seq = String(count + 1).padStart(4, "0");
    return `ORD-${today}-${seq}`;
};
const resolveOrderOwnership = async (tenantId, requesterUserId, requesterRole, payload) => {
    const paymentMethod = payload.paymentMethod ?? PaymentMethod.CASH;
    if (paymentMethod !== PaymentMethod.WALLET) {
        if (!requesterUserId && requesterRole === "GUEST") {
            return { orderUserId: undefined, orderRole: "GUEST", walletPayer: null };
        }
        return {
            orderUserId: requesterUserId,
            orderRole: requesterRole,
            walletPayer: null
        };
    }
    if (ADMIN_ROLES.has(requesterRole ?? "")) {
        const customerPhone = payload.customerPhone?.trim();
        if (!customerPhone) {
            throw new AppError("Customer phone is required for POS wallet payment", 400);
        }
        const customer = await prisma.user.findFirst({
            where: {
                tenantId,
                phone: customerPhone,
                role: { in: Array.from(WALLET_POS_ALLOWED_ROLES) },
                isActive: true,
                isApproved: true
            },
            select: { id: true, role: true, phone: true }
        });
        if (!customer) {
            throw new AppError("Teacher/staff wallet user not found for this phone", 404);
        }
        return {
            orderUserId: customer.id,
            orderRole: customer.role,
            walletPayer: customer
        };
    }
    if (!requesterUserId) {
        throw new AppError("Unauthorized", 401);
    }
    const self = await prisma.user.findFirst({
        where: { id: requesterUserId, tenantId, isActive: true, isApproved: true },
        select: { id: true, role: true, phone: true }
    });
    if (!self) {
        throw new AppError("User not found or not approved for wallet payment", 403);
    }
    return {
        orderUserId: self.id,
        orderRole: self.role,
        walletPayer: self
    };
};
const createOrder = async (tenantId, userId, role, payload) => {
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
    const ownership = await resolveOrderOwnership(tenantId, userId, role, payload);
    const orderRole = ownership.orderRole ?? role;
    const slot = parsePickupSlot(payload);
    const isTeacherOrder = orderRole === "TEACHER";
    const serviceLane = isTeacherOrder ? TEACHER_PRIORITY_LANE : REGULAR_LANE;
    if (slot.isPreOrder && !isTeacherOrder) {
        throw new AppError("Pre-order with pickup slot is available for teacher accounts only", 403);
    }
    const orderNumber = await nextOrderNumber();
    const lanePrefix = serviceLane === TEACHER_PRIORITY_LANE ? "T" : "R";
    const laneToken = `${lanePrefix}-${orderNumber}`;
    const quantityByItem = items.reduce((acc, input) => {
        acc[input.menuItemId] = (acc[input.menuItemId] ?? 0) + input.quantity;
        return acc;
    }, {});
    const created = await prisma.$transaction(async (tx) => {
        let walletBalanceAfter = null;
        if (paymentMethod === PaymentMethod.WALLET) {
            const payerId = ownership.walletPayer?.id ?? ownership.orderUserId;
            if (!payerId) {
                throw new AppError("Wallet payer is required", 400);
            }
            const deduction = await tx.user.updateMany({
                where: {
                    id: payerId,
                    tenantId,
                    walletBalance: { gte: totalAmount }
                },
                data: {
                    walletBalance: { decrement: totalAmount }
                }
            });
            if (deduction.count === 0) {
                throw new AppError("Insufficient wallet balance", 400);
            }
            const payerBalance = await tx.user.findUnique({
                where: { id: payerId },
                select: { walletBalance: true }
            });
            walletBalanceAfter = payerBalance?.walletBalance ?? 0;
        }
        const createdOrder = await tx.order.create({
            data: {
                tenantId,
                userId: ownership.orderUserId,
                orderNumber,
                status: OrderStatus.PENDING,
                serviceLane,
                laneToken,
                isPreOrder: slot.isPreOrder,
                pickupSlotLabel: slot.pickupSlotLabel,
                pickupSlotStart: slot.pickupSlotStart,
                pickupSlotEnd: slot.pickupSlotEnd,
                subtotal,
                taxAmount,
                totalAmount,
                paymentMethod,
                paymentStatus,
                items: {
                    create: items.map((input) => {
                        const menu = menuItems.find((m) => m.id === input.menuItemId);
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
        if (paymentMethod === PaymentMethod.WALLET) {
            const payerId = ownership.walletPayer?.id ?? ownership.orderUserId;
            if (!payerId) {
                throw new AppError("Wallet payer is required", 400);
            }
            await tx.walletTransaction.create({
                data: {
                    tenantId,
                    userId: payerId,
                    amount: -totalAmount,
                    balanceAfter: walletBalanceAfter ?? 0,
                    type: WalletTransactionType.DEBIT_ORDER,
                    note: `Wallet payment for order ${createdOrder.orderNumber}`,
                    reference: ownership.walletPayer?.phone ?? null,
                    orderId: createdOrder.id
                }
            });
        }
        await Promise.all(Object.entries(quantityByItem).map(async ([menuItemId, quantity]) => {
            const menu = menuItems.find((entry) => entry.id === menuItemId);
            if (!menu)
                return;
            const previousQty = menu.stockQty;
            const newQty = Math.max(previousQty - quantity, 0);
            await tx.menuItem.update({
                where: { id: menuItemId },
                data: { stockQty: { decrement: quantity } }
            });
            await tx.stockMovement.create({
                data: {
                    tenantId,
                    menuItemId,
                    actorUserId: userId,
                    changeType: StockMovementType.SALE,
                    delta: -quantity,
                    previousQty,
                    newQty,
                    note: `Auto deduction from order ${createdOrder.orderNumber}`
                }
            });
        }));
        return createdOrder;
    });
    return created;
};
const emitOrderEvents = (order) => {
    const io = getIo();
    io.emit("order:new", order);
    io.emit("kds:order_new", order);
    io.to(`tenant:${order.tenantId}`).emit("order:new", order);
    if (order.userId) {
        io.to(`user:${order.userId}`).emit("order:new", order);
    }
};
export const placeOrder = async (req, res) => {
    const tenantId = req.tenantId;
    const userId = req.user?.sub;
    const role = req.user?.role;
    const order = await createOrder(tenantId, userId, role, req.body);
    emitOrderEvents(order);
    res.status(201).json({ success: true, data: order });
};
export const placeOrderPublic = async (req, res) => {
    const tenantId = req.tenantId;
    const payload = req.body;
    // Force payment parameters for guest checkout (simulated online payment)
    payload.paymentMethod = PaymentMethod.UPI;
    payload.paymentStatus = PaymentStatus.PAID;
    // Pass undefined for userId and "GUEST" for role
    const order = await createOrder(tenantId, undefined, "GUEST", payload);
    emitOrderEvents(order);
    res.status(201).json({ success: true, data: order });
};
export const listOrders = async (req, res) => {
    const tenantId = req.tenantId;
    const role = req.user?.role;
    const userId = req.user?.sub;
    const orders = await prisma.order.findMany({
        where: {
            tenantId,
            ...(role === "ADMIN" || role === "SUPER_ADMIN" ? {} : { userId })
        },
        include: { items: true },
        orderBy: role === "ADMIN" || role === "SUPER_ADMIN"
            ? [{ serviceLane: "desc" }, { createdAt: "desc" }]
            : { createdAt: "desc" },
        take: 100
    });
    res.status(200).json({ success: true, data: orders });
};
export const getOrderById = async (req, res) => {
    const tenantId = req.tenantId;
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
export const updateOrderStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) {
        throw new AppError("status is required", 400);
    }
    const order = await prisma.order.update({
        where: { id },
        data: { status },
        include: {
            items: true,
            user: {
                select: { pushToken: true }
            }
        }
    });
    const io = getIo();
    io.emit("order:status_changed", order);
    io.to(`tenant:${order.tenantId}`).emit("order:status_changed", order);
    if (order.userId) {
        io.to(`user:${order.userId}`).emit("order:status_changed", order);
        // Send Push Notification if READY
        if (status === "READY" && order.user?.pushToken) {
            const expo = new Expo();
            const messages = [{
                    to: order.user.pushToken,
                    sound: 'default',
                    title: 'Order Ready!',
                    body: `Your order #${order.orderNumber} is ready for pickup!`,
                    data: { orderId: order.id },
                }];
            try {
                const chunks = expo.chunkPushNotifications(messages);
                for (const chunk of chunks) {
                    await expo.sendPushNotificationsAsync(chunk);
                }
            }
            catch (error) {
                console.error("Failed to send push notification:", error);
            }
        }
    }
    res.status(200).json({ success: true, data: order });
};
export const syncOrders = async (req, res) => {
    const tenantId = req.tenantId;
    const userId = req.user?.sub;
    const role = req.user?.role;
    const { orders } = req.body;
    if (!Array.isArray(orders) || orders.length === 0) {
        throw new AppError("orders array is required", 400);
    }
    const created = [];
    for (const input of orders) {
        const order = await createOrder(tenantId, userId, role, input);
        emitOrderEvents(order);
        created.push(order);
    }
    res.status(201).json({ success: true, data: created });
};
