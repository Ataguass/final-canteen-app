export type PaymentMethod = "CASH" | "UPI" | "WALLET" | "CREDIT" | "CARD" | "OTHER";
export type PaymentStatus = "PAID" | "UNPAID" | "PARTIAL";

export type OrderItem = {
  id: string;
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  note?: string | null;
};

export type Order = {
  id: string;
  tenantId: string;
  userId?: string | null;
  orderNumber: string;
  status: string;
  serviceLane?: "REGULAR" | "TEACHER_PRIORITY" | string;
  laneToken?: string | null;
  isPreOrder?: boolean;
  pickupSlotLabel?: string | null;
  pickupSlotStart?: string | null;
  pickupSlotEnd?: string | null;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  paymentStatus?: PaymentStatus;
  createdAt: string;
  items: OrderItem[];
};

export type QueuedOrder = {
  items: { menuItemId: string; quantity: number; note?: string }[];
  paymentMethod?: PaymentMethod;
  paymentStatus?: PaymentStatus;
  customerPhone?: string;
  source?: "STUDENT" | "POS";
  queuedAt: string;
};

export type PosMenuCache = {
  categories: { id: string; name: string }[];
  menu: { id: string; categoryId?: string; name: string; price: number; stockQty: number }[];
  updatedAt: string;
};
