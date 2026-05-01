import { apiRequest } from "./api";

export type InvoiceSettings = {
  id: string;
  name: string;
  logo?: string | null;
  invoiceLogoUrl?: string | null;
  invoiceShowLogo: boolean;
  invoiceShowSchoolName: boolean;
  invoiceShowOrderNumber: boolean;
  invoiceShowDate: boolean;
  invoiceShowCashier: boolean;
  invoiceShowPaymentDetails: boolean;
  invoiceShowTaxBreakup: boolean;
  invoiceShowNotes: boolean;
  invoiceFooterNote?: string | null;
};

export type FeatureSettings = {
  id: string;
  name: string;
  todaySpecialsEnabled: boolean;
};

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
    })
};
