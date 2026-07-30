import { createSlice, PayloadAction } from "@reduxjs/toolkit";

import { isSessionBoundary } from "../sessionBoundary";

interface CreatedVendor {
  name: string;
  currency: string;
  glAccountId?: string;
  taxCodeId?: string;
}

interface SelectedVendor {
  _id: string;
  displayName: string;
  qbVendorId: string;
  email: string | null;
  phone: string | null;
  address: string | null;
}

interface VendorState {
  createdVendor: CreatedVendor | null;
  selectedVendor: SelectedVendor | null;
}

const initialState: VendorState = {
  createdVendor: null,
  selectedVendor: null,
};

const vendorSlice = createSlice({
  name: "vendor",
  initialState,
  reducers: {
    setCreatedVendor: (
      state,
      action: PayloadAction<CreatedVendor>
    ) => {
      state.createdVendor = action.payload;
    },
    clearCreatedVendor: (state) => {
      state.createdVendor = null;
    },
    setSelectedVendor: (
      state,
      action: PayloadAction<SelectedVendor>
    ) => {
      state.selectedVendor = action.payload;
    },
    clearSelectedVendor: (state) => {
      state.selectedVendor = null;
    },
  },
  extraReducers: (builder) => {
    // See sessionBoundary.ts — a previous session's created/selected vendor
    // must not survive into the next session on a shared browser.
    builder.addMatcher(isSessionBoundary, () => initialState);
  },
});

export const {
  setCreatedVendor,
  clearCreatedVendor,
  setSelectedVendor,
  clearSelectedVendor,
} = vendorSlice.actions;

export default vendorSlice.reducer;
