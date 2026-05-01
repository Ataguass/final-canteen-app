import { Router } from "express";
import { auth } from "../../middleware/auth.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { roleGuard } from "../../middleware/roleGuard.js";
import { tenantResolver } from "../../middleware/tenantResolver.js";
import {
  createTenant,
  getFeatureSettings,
  getInvoiceSettings,
  listTenants,
  removeInvoiceLogo,
  resolveTenant,
  uploadInvoiceLogo,
  updateFeatureSettings,
  updateInvoiceSettings
} from "./tenants.controller.js";

export const tenantsRouter = Router();

tenantsRouter.get("/resolve", asyncHandler(resolveTenant));
tenantsRouter.get("/", asyncHandler(listTenants));
tenantsRouter.post("/", asyncHandler(createTenant));
tenantsRouter.get(
  "/me/invoice-settings",
  auth,
  tenantResolver,
  roleGuard("ADMIN", "SUPER_ADMIN"),
  asyncHandler(getInvoiceSettings)
);
tenantsRouter.patch(
  "/me/invoice-settings",
  auth,
  tenantResolver,
  roleGuard("ADMIN", "SUPER_ADMIN"),
  asyncHandler(updateInvoiceSettings)
);
tenantsRouter.post(
  "/me/invoice-logo",
  auth,
  tenantResolver,
  roleGuard("ADMIN", "SUPER_ADMIN"),
  asyncHandler(uploadInvoiceLogo)
);
tenantsRouter.delete(
  "/me/invoice-logo",
  auth,
  tenantResolver,
  roleGuard("ADMIN", "SUPER_ADMIN"),
  asyncHandler(removeInvoiceLogo)
);
tenantsRouter.get(
  "/me/feature-settings",
  auth,
  tenantResolver,
  asyncHandler(getFeatureSettings)
);
tenantsRouter.patch(
  "/me/feature-settings",
  auth,
  tenantResolver,
  roleGuard("ADMIN", "SUPER_ADMIN"),
  asyncHandler(updateFeatureSettings)
);
