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
