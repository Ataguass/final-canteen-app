import { StockMovementType } from "@prisma/client";
import { env } from "../../config/env.js";
import { prisma } from "../../config/database.js";
import { uploadStringToCloudinary } from "../../utils/cloudinary.js";
import { AppError } from "../../utils/appError.js";
const MENU_IMAGE_ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);
const parseBase64ImageDataUrl = (dataUrl) => {
    const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\r\n]+)$/);
    if (!match) {
        return null;
    }
    return {
        mimeType: match[1].toLowerCase(),
        base64: match[2].replace(/\s+/g, "")
    };
};
export const listCategories = async (req, res) => {
    const tenantId = req.tenantId;
    const categories = await prisma.category.findMany({
        where: { tenantId, isActive: true },
        orderBy: { sortOrder: "asc" }
    });
    res.status(200).json({ success: true, data: categories });
};
export const createCategory = async (req, res) => {
    const tenantId = req.tenantId;
    const { name, sortOrder = 0, description, imageUrl, isTodaySpecial = false } = req.body;
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
export const updateCategory = async (req, res) => {
    const tenantId = req.tenantId;
    const { id } = req.params;
    const { name, sortOrder, description, imageUrl, isActive, isTodaySpecial } = req.body;
    const category = await prisma.category.findFirst({ where: { id, tenantId } });
    if (!category) {
        throw new AppError("Category not found", 404);
    }
    const updated = await prisma.category.update({
        where: { id },
        data: {
            name: name === undefined ? undefined : name.trim(),
            sortOrder: sortOrder === undefined ? undefined : Math.floor(sortOrder),
            description: description === undefined ? undefined : description?.trim() ? description.trim() : null,
            imageUrl: imageUrl === undefined ? undefined : imageUrl?.trim() ? imageUrl.trim() : null,
            isActive,
            isTodaySpecial
        }
    });
    res.status(200).json({ success: true, data: updated });
};
export const listItems = async (req, res) => {
    const tenantId = req.tenantId;
    const includeAll = req.query.includeAll === "true";
    const items = await prisma.menuItem.findMany({
        where: includeAll ? { tenantId } : { tenantId, isAvailable: true },
        orderBy: { createdAt: "desc" }
    });
    res.status(200).json({ success: true, data: items });
};
export const createItem = async (req, res) => {
    const tenantId = req.tenantId;
    const { categoryId, name, price, stockQty = 0, lowStockThreshold = 10, description, image, isVeg = true, isTodaySpecial = false } = req.body;
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
export const updateItem = async (req, res) => {
    const tenantId = req.tenantId;
    const { id } = req.params;
    const { name, price, stockQty, lowStockThreshold, stockMovementType, stockNote, description, image, isVeg, categoryId, isAvailable, isTodaySpecial } = req.body;
    const item = await prisma.menuItem.findFirst({ where: { id, tenantId } });
    if (!item) {
        throw new AppError("Menu item not found", 404);
    }
    if (lowStockThreshold !== undefined &&
        (typeof lowStockThreshold !== "number" || lowStockThreshold < 0)) {
        throw new AppError("lowStockThreshold must be a non-negative number", 400);
    }
    if (stockMovementType !== undefined &&
        ![
            StockMovementType.MANUAL,
            StockMovementType.ADJUSTMENT,
            StockMovementType.SALE,
            StockMovementType.INITIAL
        ].includes(stockMovementType)) {
        throw new AppError("Invalid stockMovementType", 400);
    }
    const updated = await prisma.menuItem.update({
        where: { id },
        data: {
            name,
            price,
            stockQty,
            lowStockThreshold: lowStockThreshold === undefined ? undefined : Math.floor(lowStockThreshold),
            description: description === undefined ? undefined : description?.trim() ? description.trim() : null,
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
export const toggleItemAvailability = async (req, res) => {
    const tenantId = req.tenantId;
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
export const deleteItem = async (req, res) => {
    const tenantId = req.tenantId;
    const { id } = req.params;
    const item = await prisma.menuItem.findFirst({ where: { id, tenantId } });
    if (!item) {
        throw new AppError("Menu item not found", 404);
    }
    await prisma.menuItem.delete({ where: { id } });
    res.status(204).send();
};
export const uploadMenuImage = async (req, res) => {
    const tenantId = req.tenantId;
    const { dataUrl, target = "ITEM" } = req.body;
    if (!dataUrl || typeof dataUrl !== "string") {
        throw new AppError("dataUrl is required", 400);
    }
    const parsed = parseBase64ImageDataUrl(dataUrl.trim());
    if (!parsed || !MENU_IMAGE_ALLOWED_MIME.has(parsed.mimeType)) {
        throw new AppError("Invalid image type. Allowed: PNG, JPG, JPEG, WEBP", 400);
    }
    let imageBuffer;
    try {
        imageBuffer = Buffer.from(parsed.base64, "base64");
    }
    catch {
        throw new AppError("Invalid base64 image data", 400);
    }
    if (!imageBuffer.length) {
        throw new AppError("Image file is empty", 400);
    }
    if (imageBuffer.byteLength > env.menuImageMaxBytes) {
        throw new AppError(`Image too large. Max ${(env.menuImageMaxBytes / (1024 * 1024)).toFixed(2)} MB`, 400);
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
export const listStockMovements = async (req, res) => {
    const tenantId = req.tenantId;
    const menuItemId = req.query.menuItemId;
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
