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
