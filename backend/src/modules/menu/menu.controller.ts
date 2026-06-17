import { Request, Response } from "express";
import { StockMovementType } from "@prisma/client";
import { env } from "../../config/env.js";
import { prisma } from "../../config/database.js";
import { uploadStringToCloudinary } from "../../utils/cloudinary.js";
import { AppError } from "../../utils/appError.js";

const MENU_IMAGE_ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);

const parseBase64ImageDataUrl = (
  dataUrl: string
): { mimeType: string; base64: string } | null => {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\r\n]+)$/);
  if (!match) {
    return null;
  }
  return {
    mimeType: match[1].toLowerCase(),
    base64: match[2].replace(/\s+/g, "")
  };
};

export const listCategories = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId as string;
  const categories = await prisma.category.findMany({
    where: { tenantId, isActive: true },
    orderBy: { sortOrder: "asc" }
  });

  res.status(200).json({ success: true, data: categories });
};

export const createCategory = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId as string;
  const { name, sortOrder = 0, description, imageUrl, isTodaySpecial = false } = req.body as {
    name: string;
    sortOrder?: number;
    description?: string;
    imageUrl?: string;
    isTodaySpecial?: boolean;
  };

  if (!name) {
    throw new AppError("name is required", 400);
  }

  const category = await prisma.category.create({
    data: {
      tenantId,
      name: name.trim(),
      sortOrder: Number.isFinite(sortOrder) ? Math.floor(sortOrder) : 0,
      description: description?.trim() ? description.trim() : null,
      imageUrl: imageUrl?.trim() ? imageUrl.trim() : null,
      isTodaySpecial: Boolean(isTodaySpecial)
    }
  });
  res.status(201).json({ success: true, data: category });
};

export const updateCategory = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId as string;
  const { id } = req.params;
  const { name, sortOrder, description, imageUrl, isActive, isTodaySpecial } = req.body as {
    name?: string;
    sortOrder?: number;
    description?: string | null;
    imageUrl?: string | null;
    isActive?: boolean;
    isTodaySpecial?: boolean;
  };

  const category = await prisma.category.findFirst({ where: { id, tenantId } });
  if (!category) {
    throw new AppError("Category not found", 404);
  }

  const updated = await prisma.category.update({
    where: { id },
    data: {
      name: name === undefined ? undefined : name.trim(),
      sortOrder: sortOrder === undefined ? undefined : Math.floor(sortOrder),
      description:
        description === undefined ? undefined : description?.trim() ? description.trim() : null,
      imageUrl: imageUrl === undefined ? undefined : imageUrl?.trim() ? imageUrl.trim() : null,
      isActive,
      isTodaySpecial
    }
  });

  res.status(200).json({ success: true, data: updated });
};

export const listItems = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId as string;
  const includeAll = req.query.includeAll === "true";
  const items = await prisma.menuItem.findMany({
    where: includeAll ? { tenantId } : { tenantId, isAvailable: true },
    orderBy: { createdAt: "desc" }
  });

  res.status(200).json({ success: true, data: items });
};

export const createItem = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId as string;
  const {
    categoryId,
    name,
    price,
    stockQty = 0,
    lowStockThreshold = 10,
    description,
    image,
    isVeg = true,
    isTodaySpecial = false
  } = req.body as {
    categoryId: string;
    name: string;
    price: number;
    stockQty?: number;
    lowStockThreshold?: number;
    description?: string;
    image?: string;
    isVeg?: boolean;
    isTodaySpecial?: boolean;
  };

  if (!categoryId || !name || typeof price !== "number") {
    throw new AppError("categoryId, name, and numeric price are required", 400);
  }
  if (typeof lowStockThreshold !== "number" || lowStockThreshold < 0) {
    throw new AppError("lowStockThreshold must be a non-negative number", 400);
  }

  const item = await prisma.menuItem.create({
    data: {
      tenantId,
      categoryId,
      name,
      price,
      stockQty,
      lowStockThreshold: Math.floor(lowStockThreshold),
      description: description?.trim() ? description.trim() : null,
      image: image?.trim() ? image.trim() : null,
      isVeg,
      isTodaySpecial: Boolean(isTodaySpecial)
    }
  });

  await prisma.stockMovement.create({
    data: {
      tenantId,
      menuItemId: item.id,
      actorUserId: req.user?.sub,
      changeType: StockMovementType.INITIAL,
      delta: item.stockQty,
      previousQty: 0,
      newQty: item.stockQty,
      note: "Initial stock on item creation"
    }
  });

  res.status(201).json({ success: true, data: item });
};

export const updateItem = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId as string;
  const { id } = req.params;
  const {
    name,
    price,
    stockQty,
    lowStockThreshold,
    stockMovementType,
    stockNote,
    description,
    image,
    isVeg,
    categoryId,
    isAvailable,
    isTodaySpecial
  } =
    req.body as {
    name?: string;
    price?: number;
    stockQty?: number;
    lowStockThreshold?: number;
    stockMovementType?: StockMovementType;
    stockNote?: string;
    description?: string;
    image?: string;
    isVeg?: boolean;
    categoryId?: string;
    isAvailable?: boolean;
    isTodaySpecial?: boolean;
  };

  const item = await prisma.menuItem.findFirst({ where: { id, tenantId } });
  if (!item) {
    throw new AppError("Menu item not found", 404);
  }
  if (
    lowStockThreshold !== undefined &&
    (typeof lowStockThreshold !== "number" || lowStockThreshold < 0)
  ) {
    throw new AppError("lowStockThreshold must be a non-negative number", 400);
  }
  if (
    stockMovementType !== undefined &&
    ![
      StockMovementType.MANUAL,
      StockMovementType.ADJUSTMENT,
      StockMovementType.SALE,
      StockMovementType.INITIAL
    ].includes(stockMovementType)
  ) {
    throw new AppError("Invalid stockMovementType", 400);
  }

  const updated = await prisma.menuItem.update({
    where: { id },
    data: {
      name,
      price,
      stockQty,
      lowStockThreshold:
        lowStockThreshold === undefined ? undefined : Math.floor(lowStockThreshold),
      description:
        description === undefined ? undefined : description?.trim() ? description.trim() : null,
      image: image === undefined ? undefined : image?.trim() ? image.trim() : null,
      isVeg,
      categoryId,
      isAvailable,
      isTodaySpecial
    }
  });

  if (stockQty !== undefined && stockQty !== item.stockQty) {
    await prisma.stockMovement.create({
      data: {
        tenantId,
        menuItemId: id,
        actorUserId: req.user?.sub,
        changeType: stockMovementType ?? StockMovementType.MANUAL,
        delta: stockQty - item.stockQty,
        previousQty: item.stockQty,
        newQty: stockQty,
        note: stockNote?.trim() ? stockNote.trim() : "Stock quantity updated"
      }
    });
  }

  res.status(200).json({ success: true, data: updated });
};

export const toggleItemAvailability = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId as string;
  const { id } = req.params;

  const item = await prisma.menuItem.findFirst({ where: { id, tenantId } });
  if (!item) {
    throw new AppError("Menu item not found", 404);
  }

  const updated = await prisma.menuItem.update({
    where: { id },
    data: { isAvailable: !item.isAvailable }
  });

  res.status(200).json({ success: true, data: updated });
};

export const deleteItem = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId as string;
  const { id } = req.params;

  const item = await prisma.menuItem.findFirst({ where: { id, tenantId } });
  if (!item) {
    throw new AppError("Menu item not found", 404);
  }

  // Check if item has order history
  const hasOrderHistory = await prisma.orderItem.findFirst({
    where: { menuItemId: id }
  });
  if (hasOrderHistory) {
    throw new AppError("Cannot delete item because it has order history. Please make it unavailable instead.", 400);
  }

  // Delete associated stock movements first
  await prisma.stockMovement.deleteMany({
    where: { menuItemId: id }
  });

  await prisma.menuItem.delete({ where: { id } });
  res.status(204).send();
};

export const deleteCategory = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId as string;
  const { id } = req.params;

  const category = await prisma.category.findFirst({ where: { id, tenantId } });
  if (!category) {
    throw new AppError("Category not found", 404);
  }

  // Find all items in this category
  const items = await prisma.menuItem.findMany({
    where: { categoryId: id }
  });
  const itemIds = items.map(item => item.id);

  // Check if any of these items have order history
  if (itemIds.length > 0) {
    const hasOrderHistory = await prisma.orderItem.findFirst({
      where: { menuItemId: { in: itemIds } }
    });
    if (hasOrderHistory) {
      throw new AppError("Cannot delete category because it contains items with order history. Please make the items or category inactive instead.", 400);
    }

    // Delete associated stock movements for all items in the category
    await prisma.stockMovement.deleteMany({
      where: { menuItemId: { in: itemIds } }
    });

    // Delete all items in the category
    await prisma.menuItem.deleteMany({
      where: { categoryId: id }
    });
  }

  // Finally, delete the category itself
  await prisma.category.delete({ where: { id } });
  res.status(204).send();
};

export const uploadMenuImage = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId as string;
  const { dataUrl, target = "ITEM" } = req.body as { dataUrl?: string; target?: "ITEM" | "CATEGORY" };

  if (!dataUrl || typeof dataUrl !== "string") {
    throw new AppError("dataUrl is required", 400);
  }

  const parsed = parseBase64ImageDataUrl(dataUrl.trim());
  if (!parsed || !MENU_IMAGE_ALLOWED_MIME.has(parsed.mimeType)) {
    throw new AppError("Invalid image type. Allowed: PNG, JPG, JPEG, WEBP", 400);
  }

  let imageBuffer: Buffer;
  try {
    imageBuffer = Buffer.from(parsed.base64, "base64");
  } catch {
    throw new AppError("Invalid base64 image data", 400);
  }

  if (!imageBuffer.length) {
    throw new AppError("Image file is empty", 400);
  }

  if (imageBuffer.byteLength > env.menuImageMaxBytes) {
    throw new AppError(
      `Image too large. Max ${(env.menuImageMaxBytes / (1024 * 1024)).toFixed(2)} MB`,
      400
    );
  }

  const cleanTarget = target === "CATEGORY" ? "categories" : "items";
  const publicId = `${cleanTarget.slice(0, -1)}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const upload = await uploadStringToCloudinary({
    file: dataUrl.trim(),
    resourceType: "image",
    folder: `tenants/${tenantId}/menu/${cleanTarget}`,
    publicId
  });

  res.status(200).json({
    success: true,
    data: {
      imageUrl: upload.secureUrl
    }
  });
};

export const listStockMovements = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId as string;
  const menuItemId = req.query.menuItemId as string | undefined;
  const limitRaw = Number(req.query.limit ?? 150);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 500) : 150;

  const logs = await prisma.stockMovement.findMany({
    where: {
      tenantId,
      ...(menuItemId ? { menuItemId } : {})
    },
    include: {
      menuItem: { select: { id: true, name: true } },
      actorUser: { select: { id: true, name: true, role: true } }
    },
    orderBy: { createdAt: "desc" },
    take: limit
  });

  res.status(200).json({ success: true, data: logs });
};
