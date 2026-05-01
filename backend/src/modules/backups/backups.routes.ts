import { Router } from "express";
import { auth } from "../../middleware/auth.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { roleGuard } from "../../middleware/roleGuard.js";
import { tenantResolver } from "../../middleware/tenantResolver.js";
import { createBackup, deleteBackup, downloadBackup, listBackups, restoreBackup } from "./backups.controller.js";

export const backupsRouter = Router();

backupsRouter.get(
  "/me",
  auth,
  tenantResolver,
  roleGuard("ADMIN", "SUPER_ADMIN"),
  asyncHandler(listBackups)
);
backupsRouter.post(
  "/me",
  auth,
  tenantResolver,
  roleGuard("ADMIN", "SUPER_ADMIN"),
  asyncHandler(createBackup)
);
backupsRouter.post(
  "/me/restore",
  auth,
  tenantResolver,
  roleGuard("ADMIN", "SUPER_ADMIN"),
  asyncHandler(restoreBackup)
);
backupsRouter.get(
  "/me/:backupId/download",
  auth,
  tenantResolver,
  roleGuard("ADMIN", "SUPER_ADMIN"),
  asyncHandler(downloadBackup)
);
backupsRouter.delete(
  "/me/:backupId",
  auth,
  tenantResolver,
  roleGuard("ADMIN", "SUPER_ADMIN"),
  asyncHandler(deleteBackup)
);
