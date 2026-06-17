import { Router } from "express";
import { auth } from "../../middleware/auth.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { roleGuard } from "../../middleware/roleGuard.js";
import { tenantResolver } from "../../middleware/tenantResolver.js";
import { createBackup, deleteBackup, downloadBackup, listBackups, restoreBackup, uploadBackup } from "./backups.controller.js";
import multer from "multer";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit for JSON backups
});

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
  "/me/upload",
  auth,
  tenantResolver,
  roleGuard("ADMIN", "SUPER_ADMIN"),
  upload.single("file"),
  asyncHandler(uploadBackup)
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
