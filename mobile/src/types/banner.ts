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
