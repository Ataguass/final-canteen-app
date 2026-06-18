import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { tenantService } from "../../services/tenantService";
import { useAuthStore } from "../../stores/useAuthStore";

export const settingKeys = {
  all: ["settings"] as const,
  feature: () => [...settingKeys.all, "feature"] as const,
};

export const useFeatureSettings = () => {
  const { user, accessToken } = useAuthStore();
  
  return useQuery({
    queryKey: settingKeys.feature(),
    queryFn: async () => {
      if (!user || !accessToken) throw new Error("Not authenticated");
      try {
        const res = await tenantService.getFeatureSettings(accessToken, user.tenantId);
        return res.data;
      } catch (err) {
        return { id: "", name: "", todaySpecialsEnabled: true };
      }
    },
    enabled: !!user && !!accessToken,
  });
};

export const useUpdateFeatureSettings = () => {
  const queryClient = useQueryClient();
  const { user, accessToken } = useAuthStore();

  return useMutation({
    mutationFn: (payload: Parameters<typeof tenantService.updateFeatureSettings>[2]) => {
      if (!user || !accessToken) throw new Error("Not authenticated");
      return tenantService.updateFeatureSettings(accessToken, user.tenantId, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingKeys.feature() });
    },
  });
};
