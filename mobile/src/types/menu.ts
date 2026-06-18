export type Category = {
  id: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  isTodaySpecial?: boolean;
  sortOrder?: number;
  isActive?: boolean;
};

export type MenuItem = {
  id: string;
  categoryId?: string;
  name: string;
  price: number;
  stockQty: number;
  lowStockThreshold: number;
  isAvailable: boolean;
  isTodaySpecial?: boolean;
  description?: string | null;
  image?: string | null;
  isVeg?: boolean;
};

export type StockMovementType = "INITIAL" | "MANUAL" | "ADJUSTMENT" | "SALE";

export type StockMovement = {
  id: string;
  menuItemId: string;
  actorUserId?: string | null;
  changeType: StockMovementType;
  delta: number;
  previousQty: number;
  newQty: number;
  note?: string | null;
  createdAt: string;
  menuItem: { id: string; name: string };
  actorUser?: { id: string; name: string; role: string } | null;
};
