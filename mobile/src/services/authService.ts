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
  resolveTenant: (code: string) =>
    apiRequest<{
      success: boolean;
      data: { id: string; name: string; slug: string; schoolCode?: string | null };
    }>(`/tenants/resolve?code=${encodeURIComponent(code)}`),

  requestOtp: (tenantId: string, phone: string) =>
    apiRequest<{ success: boolean; data?: { code?: string; expiresIn: number } }>("/auth/request-otp", {
      method: "POST",
      body: { tenantId, phone }
    }),

  verifyOtp: (tenantId: string, phone: string, code: string) =>
    apiRequest<{ success: boolean }>("/auth/verify-otp", {
      method: "POST",
      body: { tenantId, phone, code }
    }),

  registerStudent: (payload: {
    tenantId: string;
    name: string;
    phone: string;
    password: string;
    rollNumber?: string;
  }) =>
    apiRequest<AuthPayload>("/auth/register/student", {
      method: "POST",
      body: payload
    }),

  login: (payload: { tenantId: string; phone: string; password: string }) =>
    apiRequest<AuthPayload>("/auth/login", {
      method: "POST",
      body: payload
    })
};
