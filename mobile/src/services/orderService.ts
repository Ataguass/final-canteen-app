import { PaymentMethod, PaymentStatus } from "./types";
import { apiRequest } from "./api";

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

type OrderPlacementPayload = {
  items: { menuItemId: string; quantity: number; note?: string }[];
  paymentMethod?: PaymentMethod;
  paymentStatus?: PaymentStatus;
  customerPhone?: string;
  isPreOrder?: boolean;
  pickupSlotLabel?: string;
  pickupSlotStart?: string;
  pickupSlotEnd?: string;
};

export const orderService = {
  placeOrder: (
    token: string,
    tenantId: string,
    payload: OrderPlacementPayload
  ) =>
    apiRequest<{ success: boolean; data: Order }>("/orders", {
      method: "POST",
      token,
      tenantId,
      body: payload
    }),

  listOrders: (token: string, tenantId: string) =>
    apiRequest<{ success: boolean; data: Order[] }>("/orders", {
      token,
      tenantId
    }),

  getOrder: (token: string, tenantId: string, id: string) =>
    apiRequest<{ success: boolean; data: Order }>(`/orders/${id}`, {
      token,
      tenantId
    }),

  syncOrders: (
    token: string,
    tenantId: string,
    orders: OrderPlacementPayload[]
  ) =>
    apiRequest<{ success: boolean; data: Order[] }>("/orders/sync", {
      method: "POST",
      token,
      tenantId,
      body: { orders }
    }),

  updateOrderStatus: (token: string, tenantId: string, orderId: string, status: string) =>
    apiRequest<{ success: boolean; data: Order }>(`/orders/${orderId}/status`, {
      method: "PATCH",
      token,
      tenantId,
      body: { status }
    })
};
