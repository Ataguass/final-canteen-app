import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orderService } from "../../services/orderService";
import { useAuthStore } from "../../stores/useAuthStore";
import { Order } from "../../types";

export const orderKeys = {
  all: ["orders"] as const,
  lists: () => [...orderKeys.all, "list"] as const,
  list: (filters: string) => [...orderKeys.lists(), { filters }] as const,
  details: () => [...orderKeys.all, "detail"] as const,
  detail: (id: string) => [...orderKeys.details(), id] as const,
};

export const useOrders = () => {
  const { user, accessToken } = useAuthStore();
  
  return useQuery({
    queryKey: orderKeys.lists(),
    queryFn: async () => {
      if (!user || !accessToken) throw new Error("Not authenticated");
      const res = await orderService.listOrders(accessToken, user.tenantId);
      return res.data;
    },
    enabled: !!user && !!accessToken,
  });
};

export const useOrder = (orderId: string) => {
  const { user, accessToken } = useAuthStore();
  
  return useQuery({
    queryKey: orderKeys.detail(orderId),
    queryFn: async () => {
      if (!user || !accessToken) throw new Error("Not authenticated");
      const res = await orderService.getOrder(accessToken, user.tenantId, orderId);
      return res.data;
    },
    enabled: !!user && !!accessToken && !!orderId,
  });
};

export const usePlaceOrder = () => {
  const queryClient = useQueryClient();
  const { user, accessToken } = useAuthStore();

  return useMutation({
    mutationFn: (payload: Parameters<typeof orderService.placeOrder>[2]) => {
      if (!user || !accessToken) throw new Error("Not authenticated");
      return orderService.placeOrder(accessToken, user.tenantId, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orderKeys.lists() });
    },
  });
};

export const useUpdateOrderStatus = () => {
  const queryClient = useQueryClient();
  const { user, accessToken } = useAuthStore();

  return useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: string }) => {
      if (!user || !accessToken) throw new Error("Not authenticated");
      return orderService.updateOrderStatus(accessToken, user.tenantId, orderId, status);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: orderKeys.lists() });
      queryClient.invalidateQueries({ queryKey: orderKeys.detail(variables.orderId) });
    },
  });
};
