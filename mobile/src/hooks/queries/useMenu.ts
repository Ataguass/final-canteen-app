import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { menuService } from "../../services/menuService";
import { useAuthStore } from "../../stores/useAuthStore";
import { Category, MenuItem } from "../../types";

export const menuKeys = {
  all: ["menu"] as const,
  categories: () => [...menuKeys.all, "categories"] as const,
  items: () => [...menuKeys.all, "items"] as const,
  item: (id: string) => [...menuKeys.items(), id] as const,
  stockMovements: () => [...menuKeys.all, "stockMovements"] as const,
};

export const useCategories = () => {
  const { user, accessToken } = useAuthStore();
  
  return useQuery({
    queryKey: menuKeys.categories(),
    queryFn: async () => {
      if (!user || !accessToken) throw new Error("Not authenticated");
      const res = await menuService.listCategories(accessToken, user.tenantId);
      return res.data;
    },
    enabled: !!user && !!accessToken,
  });
};

export const useMenuItems = () => {
  const { user, accessToken } = useAuthStore();
  
  return useQuery({
    queryKey: menuKeys.items(),
    queryFn: async () => {
      if (!user || !accessToken) throw new Error("Not authenticated");
      const res = await menuService.listItems(accessToken, user.tenantId);
      return res.data;
    },
    enabled: !!user && !!accessToken,
  });
};

export const useMenuItem = (itemId: string) => {
  const { user, accessToken } = useAuthStore();
  
  return useQuery({
    queryKey: menuKeys.item(itemId),
    queryFn: async () => {
      if (!user || !accessToken) throw new Error("Not authenticated");
      const res = await menuService.getItem(accessToken, user.tenantId, itemId);
      return res.data;
    },
    enabled: !!user && !!accessToken && !!itemId,
  });
};

// Mutations
export const useCreateCategory = () => {
  const queryClient = useQueryClient();
  const { user, accessToken } = useAuthStore();

  return useMutation({
    mutationFn: (payload: Parameters<typeof menuService.createCategory>[2]) => {
      if (!user || !accessToken) throw new Error("Not authenticated");
      return menuService.createCategory(accessToken, user.tenantId, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: menuKeys.categories() });
    },
  });
};

export const useUpdateCategory = () => {
  const queryClient = useQueryClient();
  const { user, accessToken } = useAuthStore();

  return useMutation({
    mutationFn: ({ categoryId, payload }: { categoryId: string; payload: Parameters<typeof menuService.updateCategory>[3] }) => {
      if (!user || !accessToken) throw new Error("Not authenticated");
      return menuService.updateCategory(accessToken, user.tenantId, categoryId, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: menuKeys.categories() });
    },
  });
};

export const useCreateMenuItem = () => {
  const queryClient = useQueryClient();
  const { user, accessToken } = useAuthStore();

  return useMutation({
    mutationFn: (payload: Parameters<typeof menuService.createItem>[2]) => {
      if (!user || !accessToken) throw new Error("Not authenticated");
      return menuService.createItem(accessToken, user.tenantId, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: menuKeys.items() });
    },
  });
};

export const useUpdateMenuItem = () => {
  const queryClient = useQueryClient();
  const { user, accessToken } = useAuthStore();

  return useMutation({
    mutationFn: ({ itemId, payload }: { itemId: string; payload: Parameters<typeof menuService.updateItem>[3] }) => {
      if (!user || !accessToken) throw new Error("Not authenticated");
      return menuService.updateItem(accessToken, user.tenantId, itemId, payload);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: menuKeys.items() });
      queryClient.invalidateQueries({ queryKey: menuKeys.item(variables.itemId) });
      queryClient.invalidateQueries({ queryKey: menuKeys.stockMovements() });
    },
  });
};

export const useToggleMenuItem = () => {
  const queryClient = useQueryClient();
  const { user, accessToken } = useAuthStore();

  return useMutation({
    mutationFn: (itemId: string) => {
      if (!user || !accessToken) throw new Error("Not authenticated");
      return menuService.toggleItem(accessToken, user.tenantId, itemId);
    },
    onSuccess: (_, itemId) => {
      queryClient.invalidateQueries({ queryKey: menuKeys.items() });
      queryClient.invalidateQueries({ queryKey: menuKeys.item(itemId) });
    },
  });
};

export const useDeleteMenuItem = () => {
  const queryClient = useQueryClient();
  const { user, accessToken } = useAuthStore();

  return useMutation({
    mutationFn: (itemId: string) => {
      if (!user || !accessToken) throw new Error("Not authenticated");
      return menuService.deleteItem(accessToken, user.tenantId, itemId);
    },
    onSuccess: (_, itemId) => {
      queryClient.invalidateQueries({ queryKey: menuKeys.items() });
      queryClient.removeQueries({ queryKey: menuKeys.item(itemId) });
    },
  });
};

export const useStockMovements = (options?: { menuItemId?: string; limit?: number }) => {
  const { user, accessToken } = useAuthStore();
  
  return useQuery({
    queryKey: [...menuKeys.stockMovements(), options],
    queryFn: async () => {
      if (!user || !accessToken) throw new Error("Not authenticated");
      const res = await menuService.listStockMovements(accessToken, user.tenantId, options);
      return res.data;
    },
    enabled: !!user && !!accessToken,
  });
};
