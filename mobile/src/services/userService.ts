import { apiRequest } from "./api";

export type ManageableUserRole = "TEACHER" | "STAFF";

export type ManagedUser = {
  id: string;
  name: string;
  phone?: string | null;
  role: ManageableUserRole;
  isActive: boolean;
  isApproved: boolean;
  createdAt: string;
};

export type BulkImportUserRow = {
  name: string;
  phone: string;
  password: string;
  role: ManageableUserRole;
  isApproved?: boolean;
};

export type BulkImportErrorRow = {
  rowNumber: number;
  phone: string | null;
  reason: string;
};

export type BulkImportResult = {
  totalRows: number;
  createdCount: number;
  failedCount: number;
  skippedCount: number;
  createdUsers: ManagedUser[];
  errors: BulkImportErrorRow[];
};

export type MyProfile = {
  id: string;
  tenantId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  role: "ADMIN" | "SUPER_ADMIN" | "TEACHER" | "STUDENT" | "STAFF" | "GUEST";
  rollNumber?: string | null;
  isActive: boolean;
  isApproved: boolean;
  createdAt: string;
  updatedAt: string;
};

export const userService = {
  getMe: (token: string, tenantId: string) =>
    apiRequest<{ success: boolean; data: MyProfile }>("/users/me", {
      token,
      tenantId
    }),

  updateMe: (
    token: string,
    tenantId: string,
    payload: {
      name?: string;
      phone?: string;
      rollNumber?: string;
    }
  ) =>
    apiRequest<{ success: boolean; data: MyProfile }>("/users/me", {
      method: "PATCH",
      token,
      tenantId,
      body: payload
    }),

  changeMyPassword: (
    token: string,
    tenantId: string,
    payload: {
      currentPassword: string;
      newPassword: string;
    }
  ) =>
    apiRequest<{ success: boolean; message: string }>("/users/me/password", {
      method: "PATCH",
      token,
      tenantId,
      body: payload
    }),

  listUsers: (token: string, tenantId: string) =>
    apiRequest<{ success: boolean; data: ManagedUser[] }>("/users", {
      token,
      tenantId
    }),

  createUser: (
    token: string,
    tenantId: string,
    payload: {
      name: string;
      phone: string;
      password: string;
      role: ManageableUserRole;
      isApproved?: boolean;
    }
  ) =>
    apiRequest<{ success: boolean; data: ManagedUser }>("/users", {
      method: "POST",
      token,
      tenantId,
      body: payload
    }),

  importUsers: (token: string, tenantId: string, rows: BulkImportUserRow[]) =>
    apiRequest<{ success: boolean; data: BulkImportResult }>("/users/import", {
      method: "POST",
      token,
      tenantId,
      body: { rows }
    }),

  setApproval: (token: string, tenantId: string, userId: string, isApproved: boolean) =>
    apiRequest<{ success: boolean; data: ManagedUser }>(`/users/${userId}/approval`, {
      method: "PATCH",
      token,
      tenantId,
      body: { isApproved }
    }),

  setActive: (token: string, tenantId: string, userId: string, isActive: boolean) =>
    apiRequest<{ success: boolean; data: ManagedUser }>(`/users/${userId}/active`, {
      method: "PATCH",
      token,
      tenantId,
      body: { isActive }
    }),

  resetPassword: (token: string, tenantId: string, userId: string, password: string) =>
    apiRequest<{ success: boolean; data: ManagedUser }>(`/users/${userId}/password`, {
      method: "PATCH",
      token,
      tenantId,
      body: { password }
    })
};
