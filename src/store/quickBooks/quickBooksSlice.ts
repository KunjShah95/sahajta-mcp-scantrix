import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import {
  deleteQuickBooksVendor,
  fetchQuickBooksAccounts,
  fetchQuickBooksTaxCodes,
  fetchQuickBooksVendors,
  getMyQBConnections,
  getQuickBooksStatus,
  updateQuickBooksVendor,
} from "./quickBooksApi";
import { appleLogin, googleLogin, loginUser, logoutUser } from "../auth/authApi";

export interface Vendor {
  _id: string;
  qbVendorId: string;
  displayName: string;
  normalizedName: string;
  currency?: string;
  glAccountId?: string | null;
  taxCodeId?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  syncedFromQB?: boolean;
}

export interface GLAccount {
  _id: string;
  qbAccountId: string;
  qbConnectionId: string;
  accountType: string;
  accountSubType: string;
  name: string;
  realmId: string;
  isDeleted: boolean;
}

// Confirmed live /quickbooks/taxcodes response shape: data.items[] with
// `id`/`name`/`taxRateIds`. Older field names are kept as fallbacks in case
// other environments still return the GLAccount-style shape.
export interface TaxCode {
  id?: string;
  _id?: string;
  qbTaxCodeId?: string;
  Id?: string;
  name?: string;
  Name?: string;
  description?: string;
  isDeleted?: boolean;
  taxRateIds?: { name: string; value: string }[];
}

interface QuickBooksState {
  connected: boolean;
  realmId: string;
  qbConnectionId: string;
  statusLoading: boolean;
  statusError: string | null;
  vendors: Vendor[];
  vendorsLoading: boolean;
  vendorsError: string | null;
  accounts: GLAccount[];
  accountsLoading: boolean;
  accountsError: string | null;
  taxCodes: TaxCode[];
  taxCodesLoading: boolean;
  taxCodesError: string | null;
}

const initialState: QuickBooksState = {
  connected: false,
  realmId: "",
  qbConnectionId: "",
  statusLoading: false,
  statusError: null,
  vendors: [],
  vendorsLoading: false,
  vendorsError: null,
  accounts: [],
  accountsLoading: false,
  accountsError: null,
  taxCodes: [],
  taxCodesLoading: false,
  taxCodesError: null,
};

const quickBooksSlice = createSlice({
  name: "quickBooks",
  initialState,
  reducers: {
    setConnected(state, action: PayloadAction<boolean>) {
      state.connected = action.payload;
    },
  },
  extraReducers: (builder) => {
    // ── Session boundary ────────────────────────────────────────────────
    // This is the only persisted slice in the app (see the persistReducer
    // whitelist in store/index.ts), so it's the one place a value can
    // survive across users on a shared browser. Reset it to initialState on
    // every logout and every fresh login — before any component can read a
    // qbConnectionId left over from whoever used this browser last.
    builder
      .addCase(logoutUser.fulfilled, () => initialState)
      .addCase(logoutUser.rejected, () => initialState)
      .addCase(loginUser.fulfilled, () => initialState)
      .addCase(googleLogin.fulfilled, () => initialState)
      .addCase(appleLogin.fulfilled, () => initialState);

    // ── Get My Connections (bootstrap) ─────────────────────────────────
    builder
      .addCase(getMyQBConnections.pending, (state) => {
        state.statusLoading = true;
        state.statusError = null;
      })
      .addCase(getMyQBConnections.fulfilled, (state, action) => {
        state.statusLoading = false;
        state.statusError = null;
        console.log("GET MY CONNECTIONS PAYLOAD:", JSON.stringify(action.payload, null, 2));

        const connections = action.payload?.data?.connections; // ← was action.payload?.data
        const first = Array.isArray(connections) ? connections[0] : null;

        if (first) {
          // This list refreshes constantly (every Dashboard focus), so only
          // default to the first connection when nothing is selected yet —
          // never clobber a connection the user already explicitly switched
          // to via the dropdown.
          if (!state.qbConnectionId) {
            state.qbConnectionId = first._id ?? "";
            state.realmId = first.realmId ?? "";
          }
          state.connected = true; // if a connection record exists, they're connected
        } else {
          state.connected = false;
          state.realmId = "";
          state.qbConnectionId = "";
        }
      })
      .addCase(getMyQBConnections.rejected, (state, action) => {
        state.statusLoading = false;
        const payload = action.payload as { message?: string; statusCode?: number } | undefined;
        const statusCode = payload?.statusCode;
        // 400/404 = no connection exists yet
        if (statusCode === 400 || statusCode === 404) {
          state.connected = false;
          state.realmId = "";
          state.qbConnectionId = "";
          state.statusError = null;
        } else {
          state.statusError = payload?.message || "Failed to fetch QB connections";
        }
      });

    // ── QB Status ──────────────────────────────────────────────────────
    builder
      .addCase(getQuickBooksStatus.pending, (state) => {
        state.statusLoading = true;
        state.statusError = null;
      })
      .addCase(getQuickBooksStatus.fulfilled, (state, action) => {
        state.statusLoading = false;
        state.statusError = null;
        console.log("QB STATUS PAYLOAD:", JSON.stringify(action.payload, null, 2));
        const qbData = action.payload?.data ?? action.payload;
        state.connected = qbData?.connected ?? false;
        state.realmId = qbData?.realmId ?? "";
        // The backend's status response never echoes back qbConnectionId,
        // so use the one this request was made WITH (action.meta.arg) — that's
        // the connection being switched to. Falling back to the response
        // payload would just keep the old id forever, which is what made
        // switching companies silently no-op.
        state.qbConnectionId =
          action.meta.arg.qbConnectionId || state.qbConnectionId;
      })
      .addCase(getQuickBooksStatus.rejected, (state, action) => {
        state.statusLoading = false;
        const payload = action.payload as { message?: string; statusCode?: number } | undefined;
        state.statusError = payload?.message || "Failed to fetch QuickBooks status";
      });

    // ── Vendors ────────────────────────────────────────────────────────
    builder
      .addCase(fetchQuickBooksVendors.pending, (state) => {
        state.vendorsLoading = true;
        state.vendorsError = null;
      })
      .addCase(fetchQuickBooksVendors.fulfilled, (state, action) => {
        state.vendorsLoading = false;
        state.vendors = action.payload || [];
      })
      .addCase(fetchQuickBooksVendors.rejected, (state, action) => {
        state.vendorsLoading = false;
        state.vendorsError = action.payload as string;
      });

    // ── Update / Delete Vendor ────────────────────────────────────────
    builder
      .addCase(updateQuickBooksVendor.fulfilled, (state, action) => {
        const updated = action.payload?.data?.vendor;
        if (updated?._id) {
          state.vendors = state.vendors.map((v) => (v._id === updated._id ? updated : v));
        }
      })
      .addCase(deleteQuickBooksVendor.fulfilled, (state, action) => {
        const vendorId = (action.payload as { vendorId?: string })?.vendorId;
        if (vendorId) {
          state.vendors = state.vendors.filter((v) => v._id !== vendorId);
        }
      });

    // ── GL Accounts ────────────────────────────────────────────────────
    builder
      .addCase(fetchQuickBooksAccounts.pending, (state) => {
        state.accountsLoading = true;
        state.accountsError = null;
      })
      .addCase(fetchQuickBooksAccounts.fulfilled, (state, action) => {
        state.accountsLoading = false;
        state.accounts = action.payload || [];
      })
      .addCase(fetchQuickBooksAccounts.rejected, (state, action) => {
        state.accountsLoading = false;
        state.accountsError = action.payload as string;
      });

    // ── Tax Codes ──────────────────────────────────────────────────────
    builder
      .addCase(fetchQuickBooksTaxCodes.pending, (state) => {
        state.taxCodesLoading = true;
        state.taxCodesError = null;
      })
      .addCase(fetchQuickBooksTaxCodes.fulfilled, (state, action) => {
        state.taxCodesLoading = false;
        state.taxCodes = action.payload || [];
      })
      .addCase(fetchQuickBooksTaxCodes.rejected, (state, action) => {
        state.taxCodesLoading = false;
        state.taxCodesError = action.payload as string;
      });
  },
});

export const { setConnected } = quickBooksSlice.actions;
export default quickBooksSlice.reducer;
