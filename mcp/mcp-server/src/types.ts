export interface ExtractedLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  glAccountId?: string;
}

export interface ExtractedData {
  vendorName: string;
  currency: string;
  invoiceNumber: string;
  invoiceDate?: string | null;
  dueDate?: string | null;
  amountBeforeTax: number;
  taxAmount: number;
  totalAmount: number;
  glAccountId?: string | null;
  taxCodeId?: string | null;
  lineItems: ExtractedLineItem[];
  description?: string | null;
  vendorAddress?: string | null;
  bankingDetails?: string | null;
}

export type QBMemberRole = "admin" | "accountant" | "contributor";
export type SubscriptionPlanKey = "standard" | "enterprise";
export type BillingInterval = "monthly" | "yearly";
export type VendorStatus = "active" | "inactive";
