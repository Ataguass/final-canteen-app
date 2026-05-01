import { apiRequest } from "./api";

export type Banner = {
  id: string;
  tenantId: string;
  title: string;
  imageUrl: string;
  actionUrl?: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export const bannerService = {
  listBanners: (token: string, tenantId: string, includeInactive = false) =>
    apiRequest<{ success: boolean; data: Banner[] }>(`/banners?includeInactive=${includeInactive}`, {
      token,
      tenantId
    }),

  createBanner: (
    token: string,
    tenantId: string,
    payload: { title: string; imageUrl: string; actionUrl?: string; sortOrder?: number; isActive?: boolean }
  ) =>
    apiRequest<{ success: boolean; data: Banner }>("/banners", {
      method: "POST",
      token,
      tenantId,
      body: payload
    }),

  uploadBannerImage: (token: string, tenantId: string, dataUrl: string) =>
    apiRequest<{ success: boolean; data: { imageUrl: string } }>("/banners/upload-image", {
      method: "POST",
      token,
      tenantId,
      body: { dataUrl }
    }),

  updateBanner: (
    token: string,
    tenantId: string,
    id: string,
    payload: { title?: string; imageUrl?: string; actionUrl?: string | null; sortOrder?: number; isActive?: boolean }
  ) =>
    apiRequest<{ success: boolean; data: Banner }>(`/banners/${id}`, {
      method: "PATCH",
      token,
      tenantId,
      body: payload
    }),

  toggleBanner: (token: string, tenantId: string, id: string) =>
    apiRequest<{ success: boolean; data: Banner }>(`/banners/${id}/toggle`, {
      method: "PATCH",
      token,
      tenantId
    }),

  deleteBanner: (token: string, tenantId: string, id: string) =>
    apiRequest<{ success: boolean }>(`/banners/${id}`, {
      method: "DELETE",
      token,
      tenantId
    })
};
