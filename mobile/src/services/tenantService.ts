import { apiRequest } from "./api";

import type { InvoiceSettings, FeatureSettings } from "../types";

export const tenantService = {
  getInvoiceSettings: (token: string, tenantId: string) =>
    apiRequest<{ success: boolean; data: InvoiceSettings }>("/tenants/me/invoice-settings", {
      token,
      tenantId
    }),

  updateInvoiceSettings: (
    token: string,
    tenantId: string,
    payload: Partial<
      Pick<
        InvoiceSettings,
        | "invoiceLogoUrl"
        | "invoiceShowLogo"
        | "invoiceShowSchoolName"
        | "invoiceShowOrderNumber"
        | "invoiceShowDate"
        | "invoiceShowCashier"
        | "invoiceShowPaymentDetails"
        | "invoiceShowTaxBreakup"
        | "invoiceShowNotes"
        | "invoiceFooterNote"
      >
    >
  ) =>
    apiRequest<{ success: boolean; data: InvoiceSettings }>("/tenants/me/invoice-settings", {
      method: "PATCH",
      token,
      tenantId,
      body: payload
    }),

  uploadInvoiceLogo: (token: string, tenantId: string, dataUrl: string) =>
    apiRequest<{ success: boolean; data: InvoiceSettings }>("/tenants/me/invoice-logo", {
      method: "POST",
      token,
      tenantId,
      body: { dataUrl }
    }),

  removeInvoiceLogo: (token: string, tenantId: string) =>
    apiRequest<{ success: boolean; data: InvoiceSettings }>("/tenants/me/invoice-logo", {
      method: "DELETE",
      token,
      tenantId
    }),

  getFeatureSettings: (token: string, tenantId: string) =>
    apiRequest<{ success: boolean; data: FeatureSettings }>("/tenants/me/feature-settings", {
      token,
      tenantId
    }),

  updateFeatureSettings: (
    token: string,
    tenantId: string,
    payload: Partial<Pick<FeatureSettings, "todaySpecialsEnabled">>
  ) =>
    apiRequest<{ success: boolean; data: FeatureSettings }>("/tenants/me/feature-settings", {
      method: "PATCH",
      token,
      tenantId,
      body: payload
    }),

  createTenantByAdmin: (token: string, payload: any) =>
    apiRequest<{ success: boolean; data: any }>("/tenants/admin", {
      method: "POST",
      token,
      body: payload
    })
};
