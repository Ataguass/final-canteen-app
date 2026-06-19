import { z } from "zod";

export const communityPostSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(100, "Title is too long"),
  body: z.string().min(10, "Post body must be at least 10 characters").max(2000, "Post body is too long"),
  mediaUrl: z.string().url("Must be a valid URL").nullable().optional(),
  mediaType: z.enum(["IMAGE", "VIDEO"]).nullable().optional(),
  isPinned: z.boolean(),
  isVisible: z.boolean(),
});

export const invoiceSettingsSchema = z.object({
  invoiceLogoUrl: z.string().url("Must be a valid URL").nullable().optional().or(z.literal("")),
  invoiceFooterNote: z.string().max(300, "Footer note is too long").nullable().optional(),
  invoiceShowLogo: z.boolean(),
  invoiceShowSchoolName: z.boolean(),
  invoiceShowOrderNumber: z.boolean(),
  invoiceShowDate: z.boolean(),
  invoiceShowCashier: z.boolean(),
  invoiceShowPaymentDetails: z.boolean(),
  invoiceShowTaxBreakup: z.boolean(),
  invoiceShowNotes: z.boolean(),
});

export const bannerSchema = z.object({
  title: z.string().max(100, "Title is too long").optional().or(z.literal("")),
  imageUrl: z.string().url("Valid image URL is required").min(1, "Image is required"),
  actionUrl: z.string().url("Must be a valid URL").nullable().optional().or(z.literal("")),
  isActive: z.boolean(),
  sortOrder: z.coerce.number().int().min(0),
});

export const userCreateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["TEACHER", "STAFF"]),
});

export const tenantCreateSchema = z.object({
  name: z.string().min(1, "School Name is required"),
  slug: z.string().min(1, "Slug is required").regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens"),
  schoolCode: z.string().optional(),
  adminName: z.string().min(1, "Admin Name is required"),
  adminPhone: z.string().min(10, "Admin Phone must be at least 10 digits"),
  adminPassword: z.string().min(6, "Admin Password must be at least 6 characters"),
});

export type CommunityPostFormData = z.infer<typeof communityPostSchema>;
export type InvoiceSettingsFormData = z.infer<typeof invoiceSettingsSchema>;
export type BannerFormData = z.infer<typeof bannerSchema>;
export type UserCreateFormData = z.infer<typeof userCreateSchema>;
export type TenantCreateFormData = z.infer<typeof tenantCreateSchema>;

