import { createAsyncThunk } from "@reduxjs/toolkit";

import api from "../../lib/api";

// ======================================
// TYPES
// ======================================

interface ScanInvoicePayload {
  uri: string;
  name: string;
  mimeType: string;
  qbId: string;
}

// ======================================
// COMMON ERROR HANDLER
// ======================================

const getErrorMessage = (error: any) => {
  const status = error?.response?.status;

  if (status === 401) {
    return "Your session has expired. Please login again.";
  }

  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    "Something went wrong"
  );
};

// ======================================
// SCAN INVOICE
// ======================================

export const scanInvoice = createAsyncThunk(
  "invoice/scanInvoice",
  async (data: ScanInvoicePayload, thunkAPI) => {
    try {
      const formData = new FormData();
      formData.append("files", {
        uri: data.uri,
        name: data.name || "invoice.pdf",
        type: data.mimeType || "application/pdf",
      } as any);

      const response = await api.post("/invoices", formData, {
        headers: {
          // Don't set Content-Type manually — the browser (and axios) needs
          // to generate its own multipart boundary for FormData. Setting
          // "multipart/form-data" without a boundary here breaks upload
          // parsing on the server.
          "X-QB-Id": data.qbId,
        },
      });

      return response.data;
    } catch (error: any) {
      return thunkAPI.rejectWithValue(getErrorMessage(error));
    }
  },
);

// ======================================
// GET INVOICE DETAILS
// ======================================

export const getInvoiceDetails = createAsyncThunk(
  "invoice/getInvoiceDetails",

  async (invoiceId: string, thunkAPI) => {
    try {
      console.log("========== GET INVOICE DETAILS ==========");

      const response = await api.get(`/invoices/${invoiceId}`);

      console.log("========== GET DETAILS SUCCESS ==========");

      // API wraps invoice under data.invoice — unwrap it so the rest of the
      // app can treat the payload as the invoice object directly.
      const payload = response.data;
      return payload?.data?.invoice ?? payload?.data ?? payload;
    } catch (error: any) {
      console.log("========== GET DETAILS ERROR ==========");
      console.log(error);
      return thunkAPI.rejectWithValue(getErrorMessage(error));
    }
  },
);

// ======================================
// GET ALL INVOICES
// ======================================

export const getInvoices = createAsyncThunk(
  "invoice/getInvoices",

  async (_, thunkAPI) => {
    try {
      console.log("========== GET ALL INVOICES ==========");

      const firstResponse = await api.get("/invoices?page=1&limit=100");
      const firstData = firstResponse.data?.data;
      const totalPages = firstData?.pagination?.totalPages || 1;
      let allInvoices = firstData?.invoices || [];

      if (totalPages > 1) {
        const pageRequests = [];

        for (let page = 2; page <= totalPages; page++) {
          pageRequests.push(api.get(`/invoices?page=${page}&limit=100`));
        }

        const remainingResponses = await Promise.all(pageRequests);

        remainingResponses.forEach((res) => {
          allInvoices = [
            ...allInvoices,
            ...(res.data?.data?.invoices || []),
          ];
        });
      }

      console.log("========== GET INVOICES SUCCESS ==========");
      console.log(`Total invoices fetched: ${allInvoices.length}`);

      return allInvoices;
    } catch (error: any) {
      console.log("========== GET INVOICES ERROR ==========");
      console.log(error);
      return thunkAPI.rejectWithValue(getErrorMessage(error));
    }
  },
);

// ======================================
// POST INVOICE TO QUICKBOOKS
// ======================================

export interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  /** GL account ID assigned by the LLM / user */
  glAccountId?: string;
}

export interface PostInvoiceExtractedData {
  vendorName: string;
  currency: string;
  invoiceNumber: string;
  invoiceDate?: string | null;
  dueDate?: string | null;
  amountBeforeTax: number;
  taxAmount: number;
  totalAmount: number;
  /** Top-level GL account ID */
  glAccountId?: string | null;
  lineItems: LineItem[];
  description?: string | null;
  vendorAddress?: string | null;
  /** Matches API field name `bankingDetails` (not vendorBankDetails) */
  bankingDetails?: string | null;
}

interface PostInvoicePayload {
  invoiceId: string;
  vendorId: string;
  extractedData: PostInvoiceExtractedData;
}

export const postInvoiceToQuickBooks = createAsyncThunk(
  "invoice/postInvoiceToQuickBooks",

  async (data: PostInvoicePayload, thunkAPI) => {
    try {
      console.log("========== POST TO QB ==========");

      const response = await api.patch(`/invoices/${data.invoiceId}`, {
        vendorId: data.vendorId,
        postedStatus: "manual",
        extractedData: data.extractedData,
      });

      console.log("========== POST QB SUCCESS ==========");

      return response.data;
    } catch (error: any) {
      console.log("========== POST QB ERROR ==========");
      console.log(error);
      return thunkAPI.rejectWithValue(getErrorMessage(error));
    }
  },
);

// ======================================
// UPDATE INVOICE EXTRACTED DATA (e.g. GL account)
// ======================================
// Deliberately separate from postInvoiceToQuickBooks — that thunk always
// forces postedStatus to "manual", which would be wrong here since this is
// used to patch a single field (like glAccountId) on an invoice regardless
// of its current status (auto/pending/failed).

interface UpdateInvoiceExtractedDataPayload {
  invoiceId: string;
  extractedData: Partial<PostInvoiceExtractedData>;
}

export const updateInvoiceExtractedData = createAsyncThunk(
  "invoice/updateInvoiceExtractedData",

  async (data: UpdateInvoiceExtractedDataPayload, thunkAPI) => {
    try {
      console.log("========== UPDATE INVOICE EXTRACTED DATA ==========");

      const response = await api.patch(`/invoices/${data.invoiceId}`, {
        extractedData: data.extractedData,
      });

      console.log("========== UPDATE INVOICE EXTRACTED DATA SUCCESS ==========");

      return response.data;
    } catch (error: any) {
      console.log("========== UPDATE INVOICE EXTRACTED DATA ERROR ==========");
      console.log(error);
      return thunkAPI.rejectWithValue(getErrorMessage(error));
    }
  },
);

// ======================================
// REJECT INVOICE
// ======================================

interface RejectInvoicePayload {
  invoiceId: string;
  reason?: string;
}

export const rejectInvoice = createAsyncThunk(
  "invoice/rejectInvoice",

  async (data: RejectInvoicePayload, thunkAPI) => {
    try {
      console.log("========== REJECT INVOICE ==========");

      const response = await api.patch(`/invoices/${data.invoiceId}`, {
        postedStatus: "failed",
        ...(data.reason ? { reason: data.reason } : {}),
      });

      console.log("========== REJECT INVOICE SUCCESS ==========");
      console.log(JSON.stringify(response.data, null, 2));

      return response.data;
    } catch (error: any) {
      console.log("========== REJECT INVOICE ERROR ==========");
      console.log(error);
      return thunkAPI.rejectWithValue(getErrorMessage(error));
    }
  },
);
