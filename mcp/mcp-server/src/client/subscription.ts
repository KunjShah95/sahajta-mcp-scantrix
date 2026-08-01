import type { SavetrixClient } from "./savetrixClient.js";
import type { BillingInterval, SubscriptionPlanKey } from "../types.js";

export const listPlans = async (client: SavetrixClient): Promise<unknown> => {
  const res = await client.api.get("/subscription/plans");
  return res.data;
};

export const getMySubscription = async (client: SavetrixClient): Promise<unknown> => {
  const res = await client.api.get("/subscription");
  return res.data;
};

export const choosePlan = async (
  client: SavetrixClient,
  args: { plan: SubscriptionPlanKey; billingInterval: BillingInterval },
): Promise<unknown> => {
  const res = await client.api.post("/subscription/choose-plan", args);
  return res.data;
};
