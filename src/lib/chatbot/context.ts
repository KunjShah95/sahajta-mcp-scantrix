// Shrink/redact raw Savetrix records into small, purpose-built objects before
// they go anywhere near the OpenAI API — see architecture doc §4.5/§7.6.
// Raw InvoiceRecord/Vendor objects carry fields that must never reach a
// third-party API (file.s3Url/s3Key, bankingDetails, confidenceBreakdown
// internals) and would otherwise waste tokens on every list_invoices call.
// Reuses invoiceDisplay.ts's helpers so the chatbot never describes an
// invoice differently than the Invoices page does.
import type { InvoiceRecord } from "@/store/invoice/invoiceSlice";
import type { GLAccount, TaxCode, Vendor } from "@/store/quickBooks/quickBooksSlice";
import { taxCodeId, taxCodeName } from "@/lib/quickbooks/taxCode";
import { formatInvoiceDate, getInvoiceAmount, getInvoiceStatus, getInvoiceTitle } from "@/lib/invoiceDisplay";

export interface InvoiceChatContext {
  id: string;
  title: string;
  vendor?: string;
  amount: string;
  currency?: string;
  status: string;
  date: string;
}

export function toInvoiceChatContext(invoice: InvoiceRecord): InvoiceChatContext {
  return {
    id: invoice._id,
    title: getInvoiceTitle(invoice),
    vendor: invoice.extractedData?.vendorName,
    amount: getInvoiceAmount(invoice),
    currency: invoice.extractedData?.currency,
    status: getInvoiceStatus(invoice.postedStatus),
    date: formatInvoiceDate(invoice.extractedData?.invoiceDate),
  };
}

export interface InvoiceDetailChatContext extends InvoiceChatContext {
  invoiceNumber?: string;
  dueDate: string;
  amountBeforeTax?: number;
  taxAmount?: number;
  totalAmount?: number;
  glAccountId?: string | null;
  taxCodeId?: string | null;
  description?: string | null;
  lineItems?: { description: string; quantity: number; unitPrice: number; amount: number; glAccountId?: string }[];
}

// Deliberately omits: file.s3Url/s3Key, googleDrive ids, confidenceBreakdown,
// bankingDetails, vendorAddress, and raw Mongo ids on unrelated sub-resources.
export function toInvoiceDetailChatContext(invoice: InvoiceRecord): InvoiceDetailChatContext {
  return {
    ...toInvoiceChatContext(invoice),
    invoiceNumber: invoice.extractedData?.invoiceNumber,
    dueDate: formatInvoiceDate(invoice.extractedData?.dueDate),
    amountBeforeTax: invoice.extractedData?.amountBeforeTax,
    taxAmount: invoice.extractedData?.taxAmount,
    totalAmount: invoice.extractedData?.totalAmount,
    glAccountId: invoice.extractedData?.glAccountId,
    taxCodeId: invoice.extractedData?.taxCodeId,
    description: invoice.extractedData?.description,
    lineItems: invoice.extractedData?.lineItems?.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      amount: item.amount,
      glAccountId: item.glAccountId,
    })),
  };
}

export interface VendorChatContext {
  id: string;
  displayName: string;
  currency?: string;
  glAccountId?: string | null;
  taxCodeId?: string | null;
  email?: string | null;
  phone?: string | null;
}

export function toVendorChatContext(vendor: Vendor): VendorChatContext {
  return {
    id: vendor._id,
    displayName: vendor.displayName,
    currency: vendor.currency,
    glAccountId: vendor.glAccountId,
    taxCodeId: vendor.taxCodeId,
    email: vendor.email,
    phone: vendor.phone,
  };
}

export interface GLAccountChatContext {
  id: string;
  name: string;
  accountType: string;
  accountSubType: string;
}

export function toGLAccountChatContext(account: GLAccount): GLAccountChatContext {
  return {
    id: account._id,
    name: account.name,
    accountType: account.accountType,
    accountSubType: account.accountSubType,
  };
}

export interface TaxCodeChatContext {
  id: string;
  name: string;
  description?: string;
}

export function toTaxCodeChatContext(code: TaxCode): TaxCodeChatContext {
  return {
    id: taxCodeId(code),
    name: taxCodeName(code),
    description: code.description,
  };
}
