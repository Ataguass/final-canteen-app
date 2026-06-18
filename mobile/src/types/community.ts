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
