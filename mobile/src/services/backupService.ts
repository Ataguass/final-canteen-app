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

  uploadBackup: async (token: string, tenantId: string, fileUri: string, fileName: string) => {
    const formData = new FormData();
    // @ts-ignore
    formData.append("file", {
      uri: fileUri,
      name: fileName,
      type: "application/json"
    });

    const response = await fetch(`${config.apiBaseUrl}/backups/me/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "x-tenant-id": tenantId
      },
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || "Failed to upload backup");
    }

    return response.json() as Promise<{ success: boolean; message: string; data: CreatedBackup }>;
  },

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
