import { Router } from "express";
import { auth } from "../../middleware/auth.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { roleGuard } from "../../middleware/roleGuard.js";
import { tenantResolver } from "../../middleware/tenantResolver.js";
import {
  createCategory,
  createItem,
  deleteItem,
  listCategories,
  listItems,
  listStockMovements,
  toggleItemAvailability,
  updateCategory,
  uploadMenuImage,
  updateItem
} from "./menu.controller.js";

export const menuRouter = Router();

menuRouter.get("/categories", auth, tenantResolver, asyncHandler(listCategories));
menuRouter.post(
  "/categories",
  auth,
  tenantResolver,
  roleGuard("ADMIN", "SUPER_ADMIN"),
  asyncHandler(createCategory)
);
menuRouter.patch(
  "/categories/:id",
  auth,
  tenantResolver,
  roleGuard("ADMIN", "SUPER_ADMIN"),
  asyncHandler(updateCategory)
);
menuRouter.get("/items", auth, tenantResolver, asyncHandler(listItems));
menuRouter.get(
  "/stock-movements",
  auth,
  tenantResolver,
  roleGuard("ADMIN", "SUPER_ADMIN"),
  asyncHandler(listStockMovements)
);
menuRouter.post("/items", auth, tenantResolver, roleGuard("ADMIN", "SUPER_ADMIN"), asyncHandler(createItem));
menuRouter.post(
  "/upload-image",
  auth,
  tenantResolver,
  roleGuard("ADMIN", "SUPER_ADMIN"),
  asyncHandler(uploadMenuImage)
);
menuRouter.patch(
  "/items/:id",
  auth,
  tenantResolver,
  roleGuard("ADMIN", "SUPER_ADMIN"),
  asyncHandler(updateItem)
);
menuRouter.patch(
  "/items/:id/toggle",
  auth,
  tenantResolver,
  roleGuard("ADMIN", "SUPER_ADMIN"),
  asyncHandler(toggleItemAvailability)
);
menuRouter.delete(
  "/items/:id",
  auth,
  tenantResolver,
  roleGuard("ADMIN", "SUPER_ADMIN"),
  asyncHandler(deleteItem)
);
