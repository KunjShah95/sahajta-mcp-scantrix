import { createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../lib/api";

// ================================
// GET PLANS (public catalog)
// ================================
export const fetchPlans = createAsyncThunk("subscription/fetchPlans", async (_: void, thunkAPI) => {
  try {
    console.log("========== FETCH PLANS REQUEST ==========");
    const response = await api.get("/subscription/plans");
    console.log("========== FETCH PLANS SUCCESS ==========");
    console.log(JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error: any) {
    console.log("========== FETCH PLANS ERROR ==========");
    const message =
      error?.response?.data?.message || error?.response?.data?.error || error?.message || "Failed to fetch plans";
    return thunkAPI.rejectWithValue({ message, statusCode: error?.response?.status });
  }
});

// ================================
// GET MY SUBSCRIPTION
// ================================
export const fetchMySubscription = createAsyncThunk(
  "subscription/fetchMySubscription",
  async (_: void, thunkAPI) => {
    try {
      console.log("========== FETCH MY SUBSCRIPTION REQUEST ==========");
      const response = await api.get("/subscription");
      console.log("========== FETCH MY SUBSCRIPTION SUCCESS ==========");
      console.log(JSON.stringify(response.data, null, 2));
      return response.data;
    } catch (error: any) {
      console.log("========== FETCH MY SUBSCRIPTION ERROR ==========");
      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        "Failed to fetch subscription";
      return thunkAPI.rejectWithValue({ message, statusCode: error?.response?.status });
    }
  },
);

// ================================
// CHOOSE PLAN
// ================================
export type SubscriptionPlanKey = "standard" | "enterprise";
export type BillingInterval = "monthly" | "yearly";

interface ChoosePlanPayload {
  plan: SubscriptionPlanKey;
  billingInterval: BillingInterval;
}

export const choosePlan = createAsyncThunk(
  "subscription/choosePlan",
  async (data: ChoosePlanPayload, thunkAPI) => {
    try {
      console.log("========== CHOOSE PLAN REQUEST ==========");
      console.log("POST /subscription/choose-plan", data);
      const response = await api.post("/subscription/choose-plan", data);
      console.log("========== CHOOSE PLAN SUCCESS ==========");
      console.log(JSON.stringify(response.data, null, 2));
      return response.data;
    } catch (error: any) {
      console.log("========== CHOOSE PLAN ERROR ==========");
      const message =
        error?.response?.data?.message || error?.response?.data?.error || error?.message || "Failed to switch plan";
      const code = error?.response?.data?.data?.code;
      const renewsAt = error?.response?.data?.data?.renewsAt;
      return thunkAPI.rejectWithValue({ message, statusCode: error?.response?.status, code, renewsAt });
    }
  },
);
