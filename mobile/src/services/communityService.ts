import { apiRequest } from "./api";
import { config } from "../constants/config";

export type CommunityPost = {
  id: string;
  tenantId: string;
  authorUserId?: string | null;
  title: string;
  body: string;
  mediaUrl?: string | null;
  mediaType?: "IMAGE" | "VIDEO" | null;
  isPinned: boolean;
  isVisible: boolean;
  createdAt: string;
  updatedAt: string;
  author?: { id: string; name: string; role: string } | null;
};

export const communityService = {
  listPosts: (token: string, tenantId: string, includeHidden = false) =>
    apiRequest<{ success: boolean; data: CommunityPost[] }>(
      `/community/posts?includeHidden=${includeHidden}`,
      {
        token,
        tenantId
      }
    ),

  createPost: (
    token: string,
    tenantId: string,
    payload: {
      title: string;
      body: string;
      mediaUrl?: string | null;
      mediaType?: "IMAGE" | "VIDEO" | null;
      isPinned?: boolean;
      isVisible?: boolean;
    }
  ) =>
    apiRequest<{ success: boolean; data: CommunityPost }>("/community/posts", {
      method: "POST",
      token,
      tenantId,
      body: payload
    }),

  updatePost: (
    token: string,
    tenantId: string,
    id: string,
    payload: {
      title?: string;
      body?: string;
      mediaUrl?: string | null;
      mediaType?: "IMAGE" | "VIDEO" | null;
      isPinned?: boolean;
      isVisible?: boolean;
    }
  ) =>
    apiRequest<{ success: boolean; data: CommunityPost }>(`/community/posts/${id}`, {
      method: "PATCH",
      token,
      tenantId,
      body: payload
    }),

  togglePin: (token: string, tenantId: string, id: string) =>
    apiRequest<{ success: boolean; data: CommunityPost }>(`/community/posts/${id}/pin`, {
      method: "PATCH",
      token,
      tenantId
    }),

  toggleVisibility: (token: string, tenantId: string, id: string) =>
    apiRequest<{ success: boolean; data: CommunityPost }>(`/community/posts/${id}/visibility`, {
      method: "PATCH",
      token,
      tenantId
    }),

  deletePost: (token: string, tenantId: string, id: string) =>
    apiRequest<{ success: boolean }>(`/community/posts/${id}`, {
      method: "DELETE",
      token,
      tenantId
    }),

  uploadMedia: async (
    token: string,
    tenantId: string,
    file: { uri: string; name: string; type: string }
  ): Promise<{ success: boolean; data: { mediaUrl: string; mediaType: "IMAGE" | "VIDEO" } }> => {
    const form = new FormData();
    form.append("file", {
      uri: file.uri,
      name: file.name,
      type: file.type
    } as any);

    let response: globalThis.Response;
    try {
      response = await fetch(`${config.apiBaseUrl}/community/upload-media`, {
        method: "POST",
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
          Authorization: `Bearer ${token}`,
          "x-tenant-id": tenantId
        },
        body: form
      });
    } catch {
      throw new Error(
        `Network request failed. API base is ${config.apiBaseUrl}. Check backend server and phone/PC network.`
      );
    }

    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error((json as { message?: string }).message ?? "Media upload failed");
    }

    return json as { success: boolean; data: { mediaUrl: string; mediaType: "IMAGE" | "VIDEO" } };
  }
};
