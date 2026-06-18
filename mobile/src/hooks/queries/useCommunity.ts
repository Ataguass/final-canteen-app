import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { communityService } from "../../services/communityService";
import { useAuthStore } from "../../stores/useAuthStore";

export const communityKeys = {
  all: ["community"] as const,
  posts: (includeHidden: boolean) => [...communityKeys.all, "posts", { includeHidden }] as const,
};

export const useCommunityPosts = (includeHidden = false) => {
  const { user, accessToken } = useAuthStore();
  
  return useQuery({
    queryKey: communityKeys.posts(includeHidden),
    queryFn: async () => {
      if (!user || !accessToken) throw new Error("Not authenticated");
      const res = await communityService.listPosts(accessToken, user.tenantId, includeHidden);
      return res.data;
    },
    enabled: !!user && !!accessToken,
  });
};

export const useCreatePost = () => {
  const queryClient = useQueryClient();
  const { user, accessToken } = useAuthStore();

  return useMutation({
    mutationFn: (payload: Parameters<typeof communityService.createPost>[2]) => {
      if (!user || !accessToken) throw new Error("Not authenticated");
      return communityService.createPost(accessToken, user.tenantId, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: communityKeys.all });
    },
  });
};

export const useUpdatePost = () => {
  const queryClient = useQueryClient();
  const { user, accessToken } = useAuthStore();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof communityService.updatePost>[3] }) => {
      if (!user || !accessToken) throw new Error("Not authenticated");
      return communityService.updatePost(accessToken, user.tenantId, id, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: communityKeys.all });
    },
  });
};

export const useDeletePost = () => {
  const queryClient = useQueryClient();
  const { user, accessToken } = useAuthStore();

  return useMutation({
    mutationFn: (id: string) => {
      if (!user || !accessToken) throw new Error("Not authenticated");
      return communityService.deletePost(accessToken, user.tenantId, id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: communityKeys.all });
    },
  });
};

export const useTogglePostPin = () => {
  const queryClient = useQueryClient();
  const { user, accessToken } = useAuthStore();

  return useMutation({
    mutationFn: (id: string) => {
      if (!user || !accessToken) throw new Error("Not authenticated");
      return communityService.togglePin(accessToken, user.tenantId, id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: communityKeys.all });
    },
  });
};

export const useTogglePostVisibility = () => {
  const queryClient = useQueryClient();
  const { user, accessToken } = useAuthStore();

  return useMutation({
    mutationFn: (id: string) => {
      if (!user || !accessToken) throw new Error("Not authenticated");
      return communityService.toggleVisibility(accessToken, user.tenantId, id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: communityKeys.all });
    },
  });
};
