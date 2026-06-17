import { apiRequest } from "./api";

type AuthPayload = {
  success: boolean;
  data: {
    user: {
      id: string;
      name: string;
      role: "ADMIN" | "SUPER_ADMIN" | "TEACHER" | "STUDENT" | "STAFF" | "GUEST";
      tenantId: string;
      phone?: string | null;
      email?: string | null;
      rollNumber?: string | null;
      isActive?: boolean;
      isApproved?: boolean;
    };
    accessToken: string;
    refreshToken: string;
  };
};

export const authService = {
  listTenants: () =>
    apiRequest<{
      success: boolean;
      data: Array<{ id: string; name: string; slug: string; logo?: string | null }>;
    }>("/tenants"),

  resolveTenant: (code: string) =>
    apiRequest<{
      success: boolean;
      data: { id: string; name: string; slug: string; schoolCode?: string | null };
    }>(`/tenants/resolve?code=${encodeURIComponent(code)}`),

  registerStudent: (payload: {
    tenantId: string;
    name: string;
    email: string;
    firebaseIdToken: string;
    password: string;
    rollNumber?: string;
  }) =>
    apiRequest<AuthPayload>("/auth/register/student", {
      method: "POST",
      body: payload
    }),

  login: (payload: { phone: string; rollNumber?: string; password: string; isAdminLogin?: boolean }) =>
    apiRequest<AuthPayload>("/auth/login", {
      method: "POST",
      body: payload
    })
};
