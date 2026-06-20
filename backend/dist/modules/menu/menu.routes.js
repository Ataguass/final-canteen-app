import { Router } from "express";
import { auth } from "../../middleware/auth.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { roleGuard } from "../../middleware/roleGuard.js";
import { tenantResolver } from "../../middleware/tenantResolver.js";
import { createCategory, createItem, deleteItem, deleteCategory, listCategories, listItems, listStockMovements, toggleItemAvailability, updateCategory, uploadMenuImage, updateItem } from "./menu.controller.js";
export const menuRouter = Router();
menuRouter.get("/categories", auth, tenantResolver, asyncHandler(listCategories));
menuRouter.post("/categories", auth, tenantResolver, roleGuard("ADMIN", "SUPER_ADMIN"), asyncHandler(createCategory));
menuRouter.patch("/categories/:id", auth, tenantResolver, roleGuard("ADMIN", "SUPER_ADMIN"), asyncHandler(updateCategory));
menuRouter.delete("/categories/:id", auth, tenantResolver, roleGuard("ADMIN", "SUPER_ADMIN"), asyncHandler(deleteCategory));
menuRouter.get("/items", auth, tenantResolver, asyncHandler(listItems));
menuRouter.get("/stock-movements", auth, tenantResolver, roleGuard("ADMIN", "SUPER_ADMIN"), asyncHandler(listStockMovements));
menuRouter.post("/items", auth, tenantResolver, roleGuard("ADMIN", "SUPER_ADMIN"), asyncHandler(createItem));
menuRouter.post("/upload-image", auth, tenantResolver, roleGuard("ADMIN", "SUPER_ADMIN"), asyncHandler(uploadMenuImage));
menuRouter.patch("/items/:id", auth, tenantResolver, roleGuard("ADMIN", "SUPER_ADMIN"), asyncHandler(updateItem));
menuRouter.patch("/items/:id/toggle", auth, tenantResolver, roleGuard("ADMIN", "SUPER_ADMIN"), asyncHandler(toggleItemAvailability));
menuRouter.delete("/items/:id", auth, tenantResolver, roleGuard("ADMIN", "SUPER_ADMIN"), asyncHandler(deleteItem));
// ── Public menu for QR ordering (no auth) ────────────────────────────
menuRouter.get("/public/categories", asyncHandler(async (req, res) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) {
        res.status(400).json({ success: false, message: "tenantId is required" });
        return;
    }
    const categories = await (await import("../../config/database.js")).prisma.category.findMany({
        where: { tenantId, isActive: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, imageUrl: true, description: true }
    });
    res.status(200).json({ success: true, data: categories });
}));
menuRouter.get("/public/items", asyncHandler(async (req, res) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) {
        res.status(400).json({ success: false, message: "tenantId is required" });
        return;
    }
    const items = await (await import("../../config/database.js")).prisma.menuItem.findMany({
        where: { tenantId, isAvailable: true },
        orderBy: { createdAt: "desc" },
        select: { id: true, categoryId: true, name: true, price: true, description: true, image: true, isVeg: true, isTodaySpecial: true, stockQty: true }
    });
    res.status(200).json({ success: true, data: items });
}));
