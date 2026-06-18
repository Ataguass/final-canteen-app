import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { userService } from "../../services/userService";
import { useAuthStore } from "../../stores/useAuthStore";

export const userKeys = {
  all: ["users"] as const,
  me: () => [...userKeys.all, "me"] as const,
  lists: () => [...userKeys.all, "list"] as const,
};

export const useMyProfile = () => {
  const { user, accessToken } = useAuthStore();
  
  return useQuery({
    queryKey: userKeys.me(),
    queryFn: async () => {
      if (!user || !accessToken) throw new Error("Not authenticated");
      const res = await userService.getMe(accessToken, user.tenantId);
      return res.data;
    },
    enabled: !!user && !!accessToken,
  });
};

export const useManagedUsers = () => {
  const { user, accessToken } = useAuthStore();
  
  return useQuery({
    queryKey: userKeys.lists(),
    queryFn: async () => {
      if (!user || !accessToken) throw new Error("Not authenticated");
      const res = await userService.listUsers(accessToken, user.tenantId);
      return res.data;
    },
    enabled: !!user && !!accessToken,
  });
};

export const useUpdateMe = () => {
  const queryClient = useQueryClient();
  const { user, accessToken, setSessionUser } = useAuthStore();

  return useMutation({
    mutationFn: (payload: Parameters<typeof userService.updateMe>[2]) => {
      if (!user || !accessToken) throw new Error("Not authenticated");
      return userService.updateMe(accessToken, user.tenantId, payload);
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: userKeys.me() });
      if (res.data) {
        setSessionUser({ ...user!, ...res.data });
      }
    },
  });
};

export const useCreateUser = () => {
  const queryClient = useQueryClient();
  const { user, accessToken } = useAuthStore();

  return useMutation({
    mutationFn: (payload: Parameters<typeof userService.createUser>[2]) => {
      if (!user || !accessToken) throw new Error("Not authenticated");
      return userService.createUser(accessToken, user.tenantId, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });
};

export const useUpdateUserApproval = () => {
  const queryClient = useQueryClient();
  const { user, accessToken } = useAuthStore();

  return useMutation({
    mutationFn: ({ userId, isApproved }: { userId: string; isApproved: boolean }) => {
      if (!user || !accessToken) throw new Error("Not authenticated");
      return userService.setApproval(accessToken, user.tenantId, userId, isApproved);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });
};

export const useUpdateUserActive = () => {
  const queryClient = useQueryClient();
  const { user, accessToken } = useAuthStore();

  return useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) => {
      if (!user || !accessToken) throw new Error("Not authenticated");
      return userService.setActive(accessToken, user.tenantId, userId, isActive);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });
};
