import { apiRequest } from "./api";
import { config } from "../constants/config";

export type BackupFile = {
  id: string;
  sizeBytes: number;
  createdAt: string;
  updatedAt: string;
};

export type BackupCounts = {
  users: number;
  categories: number;
  menuItems: number;
  banners: number;
  communityPosts: number;
  orders: number;
  orderItems: number;
  stockMovements: number;
};

export type CreatedBackup = {
  id: string;
  createdAt: string;
  sizeBytes: number;
  counts: BackupCounts;
};

export const backupService = {
  listBackups: (token: string, tenantId: string) =>
    apiRequest<{ success: boolean; data: BackupFile[] }>("/backups/me", {
      token,
      tenantId
    }),

  createBackup: (token: string, tenantId: string) =>
    apiRequest<{ success: boolean; data: CreatedBackup }>("/backups/me", {
      method: "POST",
      token,
      tenantId
    }),

  restoreBackup: (token: string, tenantId: string, backupId: string) =>
    apiRequest<{
      success: boolean;
      message: string;
      data: { restoredFrom: string; counts: BackupCounts };
    }>("/backups/me/restore", {
      method: "POST",
      token,
      tenantId,
      body: { backupId }
    }),

  deleteBackup: (token: string, tenantId: string, backupId: string) =>
    apiRequest<{ success: boolean; message: string }>(`/backups/me/${encodeURIComponent(backupId)}`, {
      method: "DELETE",
      token,
      tenantId
    }),

  downloadUrl: (backupId: string, format: "zip" | "json" = "zip") =>
    `${config.apiBaseUrl}/backups/me/${encodeURIComponent(backupId)}/download?format=${format}`
};
