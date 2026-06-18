import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { bannerService } from "../../services/bannerService";
import { useAuthStore } from "../../stores/useAuthStore";

export const bannerKeys = {
  all: ["banners"] as const,
  lists: () => [...bannerKeys.all, "list"] as const,
};

export const useBanners = () => {
  const { user, accessToken } = useAuthStore();
  
  return useQuery({
    queryKey: bannerKeys.lists(),
    queryFn: async () => {
      if (!user || !accessToken) throw new Error("Not authenticated");
      const res = await bannerService.listBanners(accessToken, user.tenantId);
      return res.data;
    },
    enabled: !!user && !!accessToken,
  });
};

export const useCreateBanner = () => {
  const queryClient = useQueryClient();
  const { user, accessToken } = useAuthStore();

  return useMutation({
    mutationFn: (payload: Parameters<typeof bannerService.createBanner>[2]) => {
      if (!user || !accessToken) throw new Error("Not authenticated");
      return bannerService.createBanner(accessToken, user.tenantId, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bannerKeys.lists() });
    },
  });
};

export const useDeleteBanner = () => {
  const queryClient = useQueryClient();
  const { user, accessToken } = useAuthStore();

  return useMutation({
    mutationFn: (id: string) => {
      if (!user || !accessToken) throw new Error("Not authenticated");
      return bannerService.deleteBanner(accessToken, user.tenantId, id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bannerKeys.lists() });
    },
  });
};
