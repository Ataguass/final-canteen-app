import { apiRequest } from "./api";

export type WalletTransactionType = "TOPUP" | "DEBIT_ORDER" | "REFUND" | "ADJUSTMENT";

export type WalletTransaction = {
  id: string;
  amount: number;
  balanceAfter: number;
  type: WalletTransactionType;
  note?: string | null;
  reference?: string | null;
  orderId?: string | null;
  createdAt: string;
};

export type WalletPayload = {
  userId: string;
  role: "ADMIN" | "SUPER_ADMIN" | "TEACHER" | "STUDENT" | "STAFF" | "GUEST";
  balance: number;
  transactions: WalletTransaction[];
};

export const walletService = {
  getMe: (token: string, tenantId: string) =>
    apiRequest<{ success: boolean; data: WalletPayload }>("/wallet/me", {
      token,
      tenantId
    }),

  topUp: (
    token: string,
    tenantId: string,
    payload: { amount: number; upiReference?: string; note?: string }
  ) =>
    apiRequest<{
      success: boolean;
      data: {
        balance: number;
        transaction: WalletTransaction;
      };
    }>("/wallet/me/topup", {
      method: "POST",
      token,
      tenantId,
      body: payload
    })
};
