export type ManageableUserRole = "TEACHER" | "STAFF";

export type User = {
  id: string;
  name: string;
  role: "ADMIN" | "SUPER_ADMIN" | "TEACHER" | "STUDENT" | "STAFF" | "GUEST";
  tenantId: string;
  email?: string | null;
  phone?: string | null;
  rollNumber?: string | null;
  isActive?: boolean;
  isApproved?: boolean;
};

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
