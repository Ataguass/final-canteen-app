import { apiRequest } from "./api";

export type Category = {
  id: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  isTodaySpecial?: boolean;
  sortOrder?: number;
  isActive?: boolean;
};

export type MenuItem = {
  id: string;
  categoryId?: string;
  name: string;
  price: number;
  stockQty: number;
  lowStockThreshold: number;
  isAvailable: boolean;
  isTodaySpecial?: boolean;
  description?: string | null;
  image?: string | null;
  isVeg?: boolean;
};

export type StockMovementType = "INITIAL" | "MANUAL" | "ADJUSTMENT" | "SALE";

export type StockMovement = {
  id: string;
  menuItemId: string;
  actorUserId?: string | null;
  changeType: StockMovementType;
  delta: number;
  previousQty: number;
  newQty: number;
  note?: string | null;
  createdAt: string;
  menuItem: { id: string; name: string };
  actorUser?: { id: string; name: string; role: string } | null;
};

export const menuService = {
  listCategories: (token: string, tenantId: string) =>
    apiRequest<{ success: boolean; data: Category[] }>("/menu/categories", {
      token,
      tenantId
    }),

  createCategory: (
    token: string,
    tenantId: string,
    payload: {
      name: string;
      description?: string;
      imageUrl?: string;
      sortOrder?: number;
      isTodaySpecial?: boolean;
    }
  ) =>
    apiRequest<{ success: boolean; data: Category }>("/menu/categories", {
      method: "POST",
      token,
      tenantId,
      body: payload
    }),

  updateCategory: (
    token: string,
    tenantId: string,
    categoryId: string,
    payload: {
      name?: string;
      description?: string | null;
      imageUrl?: string | null;
      sortOrder?: number;
      isActive?: boolean;
      isTodaySpecial?: boolean;
    }
  ) =>
    apiRequest<{ success: boolean; data: Category }>(`/menu/categories/${categoryId}`, {
      method: "PATCH",
      token,
      tenantId,
      body: payload
    }),

  listItems: (token: string, tenantId: string) =>
    apiRequest<{ success: boolean; data: MenuItem[] }>("/menu/items?includeAll=true", {
      token,
      tenantId
    }),

  getItem: async (token: string, tenantId: string, itemId: string) => {
    const response = await apiRequest<{ success: boolean; data: MenuItem[] }>("/menu/items?includeAll=true", {
      token,
      tenantId
    });
    const item = response.data.find((x) => x.id === itemId);
    if (!item) {
      throw new Error("Item not found");
    }
    return { success: true, data: item };
  },

  createItem: (
    token: string,
    tenantId: string,
    payload: {
      categoryId: string;
      name: string;
      price: number;
      stockQty: number;
      lowStockThreshold?: number;
      description?: string;
      image?: string;
      isVeg?: boolean;
      isTodaySpecial?: boolean;
    }
  ) =>
    apiRequest<{ success: boolean; data: MenuItem }>("/menu/items", {
      method: "POST",
      token,
      tenantId,
      body: payload
    }),

  updateItem: (
    token: string,
    tenantId: string,
    itemId: string,
    payload: {
      categoryId?: string;
      name?: string;
      price?: number;
      stockQty?: number;
      lowStockThreshold?: number;
      stockMovementType?: StockMovementType;
      stockNote?: string;
      description?: string;
      image?: string;
      isVeg?: boolean;
      isAvailable?: boolean;
      isTodaySpecial?: boolean;
    }
  ) =>
    apiRequest<{ success: boolean; data: MenuItem }>(`/menu/items/${itemId}`, {
      method: "PATCH",
      token,
      tenantId,
      body: payload
    }),

  uploadMenuImage: (
    token: string,
    tenantId: string,
    dataUrl: string,
    target: "ITEM" | "CATEGORY"
  ) =>
    apiRequest<{ success: boolean; data: { imageUrl: string } }>("/menu/upload-image", {
      method: "POST",
      token,
      tenantId,
      body: { dataUrl, target }
    }),

  toggleItem: (token: string, tenantId: string, itemId: string) =>
    apiRequest<{ success: boolean; data: MenuItem }>(`/menu/items/${itemId}/toggle`, {
      method: "PATCH",
      token,
      tenantId
    }),

  deleteItem: (token: string, tenantId: string, itemId: string) =>
    apiRequest<{ success: boolean }>(`/menu/items/${itemId}`, {
      method: "DELETE",
      token,
      tenantId
    }),

  listStockMovements: (token: string, tenantId: string, options?: { menuItemId?: string; limit?: number }) => {
    const search = new URLSearchParams();
    if (options?.menuItemId) search.set("menuItemId", options.menuItemId);
    if (options?.limit) search.set("limit", String(options.limit));
    const query = search.toString();
    return apiRequest<{ success: boolean; data: StockMovement[] }>(
      `/menu/stock-movements${query ? `?${query}` : ""}`,
      {
        token,
        tenantId
      }
    );
  }
};
