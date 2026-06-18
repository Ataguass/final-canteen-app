import { apiRequest } from "./api";
import type { 
  ManageableUserRole, 
  ManagedUser, 
  BulkImportUserRow, 
  BulkImportErrorRow, 
  BulkImportResult, 
  MyProfile 
} from "../types";

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
      email?: string;
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
