export type BackupFile = {
  id: string;
  sizeBytes: number;
  createdAt: string;
  updatedAt: string;
};

export type BackupCounts = {
  users: number;
  categories: number;
  menuItems: number;
  banners: number;
  communityPosts: number;
  orders: number;
  orderItems: number;
  stockMovements: number;
};

export type CreatedBackup = {
  id: string;
  createdAt: string;
  sizeBytes: number;
  counts: BackupCounts;
};
