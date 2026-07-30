import { createSlice } from "@reduxjs/toolkit";

import { isSessionBoundary } from "../sessionBoundary";

import {
  scanInvoice,
  getInvoiceDetails,
  getInvoices,
  postInvoiceToQuickBooks,
  updateInvoiceExtractedData,
  rejectInvoice,
} from "./invoiceApi";

// ======================================
// TYPES
// ======================================

export interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  glAccountId?: string;
}

export interface ExtractedData {
  vendorName?: string;
  currency?: string;
  invoiceNumber?: string;
  invoiceDate?: string | null;
  dueDate?: string | null;
  amountBeforeTax?: number;
  taxAmount?: number;
  totalAmount?: number;
  glAccountId?: string | null;
  taxCodeId?: string | null;
  lineItems?: LineItem[];
  description?: string | null;
  vendorAddress?: string | null;
  /** API field: bankingDetails (not vendorBankDetails) */
  bankingDetails?: string | null;
}

export interface ConfidenceBreakdown {
  isDuplicate?: boolean;
  imageQualityScore?: number;
  mistralConfidenceScore?: number;
  llmConfidenceScore?: number;
  lowConfidenceFields?: string[];
  missingFields?: string[];
  scoreDeductions?: Record<string, boolean>;
}

export interface QuickBooksData {
  billUrl?: string | null;
  vendorId?: string;
  billId?: string;
  postedAt?: string;
  postedBy?: string;
}

export interface VendorData {
  vendorDbId?: string;
  resolutionStatus?: "exact" | "suggested" | "unresolved";
  suggestedVendors?: any[];
}

export interface FileData {
  s3Url?: string;
  s3Key?: string;
  type?: string;
  originalName?: string;
  mimeType?: string;
  sizeBytes?: number;
}

export interface StatusHistoryItem {
  postedStatus?: string;
  changedAt?: string;
  changedBy?: string;
  reason?: string;
}

export interface InvoiceRecord {
  _id: string;
  userId?: string;
  batchId?: string;
  postedStatus?: string;
  confidenceScore?: number;
  extractedData?: ExtractedData;
  confidenceBreakdown?: ConfidenceBreakdown;
  quickbooks?: QuickBooksData;
  vendor?: VendorData;
  file?: FileData;
  googleDrive?: { fileId?: string | null; fileUrl?: string | null; uploadedAt?: string | null };
  statusHistory?: StatusHistoryItem[];
  processedBy?: string;
  extractedByModel?: string;
  normalizedInvoiceNumber?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface InvoiceState {
  loading: boolean;
  invoiceData: any;
  invoiceDetails: InvoiceRecord | null;
  invoices: InvoiceRecord[];
  autoPostedInvoices: InvoiceRecord[];
  manualPostedInvoices: InvoiceRecord[];
  pendingInvoices: InvoiceRecord[];
  failedInvoices: InvoiceRecord[];
  selectedInvoice: InvoiceRecord | null;
  posting: boolean;
  postingError: any;
  rejecting: boolean;
  rejectingError: any;
  updatingExtractedData: boolean;
  updatingExtractedDataError: any;
  error: any;
}

// ======================================
// INITIAL STATE
// ======================================

const initialState: InvoiceState = {
  loading: false,
  invoiceData: null,
  invoiceDetails: null,
  invoices: [],
  autoPostedInvoices: [],
  manualPostedInvoices: [],
  pendingInvoices: [],
  failedInvoices: [],
  selectedInvoice: null,
  posting: false,
  postingError: null,
  rejecting: false,
  rejectingError: null,
  updatingExtractedData: false,
  updatingExtractedDataError: null,
  error: null,
};

// ======================================
// SLICE
// ======================================

const invoiceSlice = createSlice({
  name: "invoice",

  initialState,

  reducers: {
    setSelectedInvoice: (state, action) => {
      state.selectedInvoice = action.payload;
    },

    clearSelectedInvoice: (state) => {
      state.selectedInvoice = null;
    },
  },

  extraReducers: (builder) => {
    // ======================================
    // SCAN INVOICE
    // ======================================

    builder.addCase(scanInvoice.pending, (state) => {
      state.loading = true;
      state.error = null;
    });

    builder.addCase(scanInvoice.fulfilled, (state, action) => {
      state.loading = false;
      state.invoiceData = action.payload;
    });

    builder.addCase(scanInvoice.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload;
    });

    // ======================================
    // GET INVOICE DETAILS
    // ======================================

    builder.addCase(getInvoiceDetails.pending, (state) => {
      state.loading = true;
      state.error = null;
    });

    builder.addCase(getInvoiceDetails.fulfilled, (state, action) => {
      state.loading = false;
      // Payload is already the unwrapped invoice object (see invoiceApi.ts)
      state.invoiceDetails = action.payload;
      // Also keep selectedInvoice in sync so InvoiceReviewScreen always has
      // the freshest data when navigating directly via invoiceId.
      state.selectedInvoice = action.payload;
    });

    builder.addCase(getInvoiceDetails.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload;
    });

    // ======================================
    // GET ALL INVOICES
    // ======================================

    builder.addCase(getInvoices.pending, (state) => {
      state.loading = true;
      state.error = null;
    });

    builder.addCase(getInvoices.fulfilled, (state, action) => {
      state.loading = false;
      state.invoices = action.payload || [];

      state.autoPostedInvoices = state.invoices.filter(
        (item) => item?.postedStatus === "auto",
      );
      state.manualPostedInvoices = state.invoices.filter(
        (item) => item?.postedStatus === "manual",
      );
      state.pendingInvoices = state.invoices.filter(
        (item) => item?.postedStatus === "pending",
      );
      state.failedInvoices = state.invoices.filter(
        (item) => item?.postedStatus === "failed",
      );
    });

    builder.addCase(getInvoices.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload;
      // A failed fetch (e.g. token expiry, or a genuinely disconnected
      // account getting a 400 for missing X-QB-Id) must not leave a
      // previous successful fetch's data on screen — otherwise the UI
      // renders stale invoices as if they belong to whoever's looking now.
      state.invoices = [];
      state.autoPostedInvoices = [];
      state.manualPostedInvoices = [];
      state.pendingInvoices = [];
      state.failedInvoices = [];
    });

    // ======================================
    // POST TO QUICKBOOKS
    // ======================================

    builder.addCase(postInvoiceToQuickBooks.pending, (state) => {
      state.posting = true;
      state.postingError = null;
    });

    builder.addCase(postInvoiceToQuickBooks.fulfilled, (state, action) => {
      state.posting = false;
      state.selectedInvoice = action.payload?.data ?? state.selectedInvoice;
    });

    builder.addCase(postInvoiceToQuickBooks.rejected, (state, action) => {
      state.posting = false;
      state.postingError = action.payload;
    });

    // ======================================
    // REJECT INVOICE
    // ======================================

    builder.addCase(rejectInvoice.pending, (state) => {
      state.rejecting = true;
      state.rejectingError = null;
    });

    builder.addCase(rejectInvoice.fulfilled, (state, action) => {
      state.rejecting = false;
      state.selectedInvoice = action.payload?.data ?? state.selectedInvoice;

      const updatedInvoice: InvoiceRecord = action.payload?.data;
      if (updatedInvoice?._id) {
        state.pendingInvoices = state.pendingInvoices.filter(
          (inv) => inv._id !== updatedInvoice._id,
        );
        state.failedInvoices = [updatedInvoice, ...state.failedInvoices];
        state.invoices = state.invoices.map((inv) =>
          inv._id === updatedInvoice._id ? updatedInvoice : inv,
        );
      }
    });

    builder.addCase(rejectInvoice.rejected, (state, action) => {
      state.rejecting = false;
      state.rejectingError = action.payload;
    });

    // ======================================
    // UPDATE INVOICE EXTRACTED DATA
    // ======================================

    builder.addCase(updateInvoiceExtractedData.pending, (state) => {
      state.updatingExtractedData = true;
      state.updatingExtractedDataError = null;
    });

    builder.addCase(updateInvoiceExtractedData.fulfilled, (state, action) => {
      state.updatingExtractedData = false;

      const updatedInvoice: InvoiceRecord = action.payload?.data;
      if (updatedInvoice?._id) {
        state.selectedInvoice = updatedInvoice;
        state.invoices = state.invoices.map((inv) =>
          inv._id === updatedInvoice._id ? updatedInvoice : inv,
        );
      }
    });

    builder.addCase(updateInvoiceExtractedData.rejected, (state, action) => {
      state.updatingExtractedData = false;
      state.updatingExtractedDataError = action.payload;
    });

    // ======================================
    // SESSION BOUNDARY
    // ======================================
    // Not persisted, but very much alive in memory for the tab's whole SPA
    // lifetime — a logout/login/register that never hard-reloads the page
    // would otherwise leave the previous account's invoices rendering under
    // the new session. Reset on every session start/end (see
    // sessionBoundary.ts).
    builder.addMatcher(isSessionBoundary, () => initialState);
  },
});

export const { setSelectedInvoice, clearSelectedInvoice } =
  invoiceSlice.actions;

export default invoiceSlice.reducer;
