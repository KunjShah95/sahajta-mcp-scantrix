import { createSlice } from "@reduxjs/toolkit";
import { fetchPlans, fetchMySubscription, choosePlan } from "./subscriptionApi";
import { isSessionBoundary } from "../sessionBoundary";

export interface PlanCatalogEntry {
  key: "trial" | "standard" | "enterprise";
  name: string;
  maxSlots: number;
  trialDays?: number;
  prices: { monthly: number; yearly: number } | null;
}

export interface SubscriptionSlot {
  qbConnectionId: string;
  name: string;
  realmId: string;
  locked: boolean;
  lockedAt: string | null;
  unlockAt: string | null;
}

export interface MySubscription {
  plan: "trial" | "standard" | "enterprise";
  planName: string;
  status: "trialing" | "active" | "past_due" | "canceled" | "expired";
  billingInterval: "monthly" | "yearly" | null;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  billingAnchor: string | null;
  currentPeriod: { start: string; end: string } | null;
  lockCycle: { start: string; end: string } | null;
  downgradeAvailableAt: string | null;
  maxSlots: number;
  slotsUsed: number;
  slots: SubscriptionSlot[];
}

interface SubscriptionState {
  plans: PlanCatalogEntry[];
  plansLoading: boolean;
  plansError: string | null;

  subscription: MySubscription | null;
  subscriptionLoading: boolean;
  subscriptionError: string | null;

  choosingPlan: boolean;
}

const initialState: SubscriptionState = {
  plans: [],
  plansLoading: false,
  plansError: null,

  subscription: null,
  subscriptionLoading: false,
  subscriptionError: null,

  choosingPlan: false,
};

const subscriptionSlice = createSlice({
  name: "subscription",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchPlans.pending, (state) => {
        state.plansLoading = true;
        state.plansError = null;
      })
      .addCase(fetchPlans.fulfilled, (state, action) => {
        state.plansLoading = false;
        state.plans = action.payload?.data?.plans ?? [];
      })
      .addCase(fetchPlans.rejected, (state, action) => {
        state.plansLoading = false;
        const payload = action.payload as { message?: string } | undefined;
        state.plansError = payload?.message || "Failed to fetch plans";
      });

    builder
      .addCase(fetchMySubscription.pending, (state) => {
        state.subscriptionLoading = true;
        state.subscriptionError = null;
      })
      .addCase(fetchMySubscription.fulfilled, (state, action) => {
        state.subscriptionLoading = false;
        state.subscription = action.payload?.data ?? null;
      })
      .addCase(fetchMySubscription.rejected, (state, action) => {
        state.subscriptionLoading = false;
        const payload = action.payload as { message?: string } | undefined;
        state.subscriptionError = payload?.message || "Failed to fetch subscription";
      });

    builder
      .addCase(choosePlan.pending, (state) => {
        state.choosingPlan = true;
      })
      .addCase(choosePlan.fulfilled, (state) => {
        state.choosingPlan = false;
        // Caller re-dispatches fetchMySubscription for the authoritative
        // post-switch state (slots/lock/period) rather than hand-merging the
        // choose-plan response shape into MySubscription here.
      })
      .addCase(choosePlan.rejected, (state) => {
        state.choosingPlan = false;
      });

    // See sessionBoundary.ts — plan/subscription/billing-slot data is
    // account-scoped and must not survive into the next session on a
    // shared browser.
    builder.addMatcher(isSessionBoundary, () => initialState);
  },
});

export default subscriptionSlice.reducer;
