import { apiRequest } from "./api";

import type { WalletTransactionType, WalletTransaction, WalletPayload } from "../types";

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
