import type { SavetrixClient } from "./savetrixClient.js";
import { unwrapList } from "./unwrap.js";
import type { VendorStatus } from "../types.js";

export interface VendorFields {
  displayName: string;
  currency: string;
  email?: string;
  phone?: string;
  address?: string;
  glAccountId?: string;
  taxCodeId?: string;
}

export const listVendors = async (
  client: SavetrixClient,
  status: VendorStatus,
): Promise<unknown> => {
  const res = await client.api.get("/quickbooks/vendors", {
    params: status === "inactive" ? { status: "inactive" } : {},
  });
  return unwrapList(res, ["vendors"]);
};

export const createVendor = async (
  client: SavetrixClient,
  args: VendorFields,
): Promise<unknown> => {
  const res = await client.api.post("/quickbooks/vendors", {
    displayName: args.displayName,
    currency: args.currency,
    glAccountId: args.glAccountId ?? "",
    taxCodeId: args.taxCodeId ?? "",
    ...(args.email ? { email: args.email } : {}),
    ...(args.phone ? { phone: args.phone } : {}),
    ...(args.address ? { address: args.address } : {}),
  });
  return res.data;
};

export const updateVendor = async (
  client: SavetrixClient,
  args: { vendorId: string; displayName?: string; currency?: string; email?: string; phone?: string; address?: string; glAccountId?: string; taxCodeId?: string },
): Promise<unknown> => {
  const { vendorId, ...fields } = args;
  const body: Record<string, string> = {};
  for (const key of ["displayName", "currency", "email", "phone", "address", "glAccountId", "taxCodeId"] as const) {
    if (fields[key] !== undefined) body[key] = fields[key] as string;
  }
  const res = await client.api.patch(`/quickbooks/vendors/${vendorId}`, body);
  return res.data;
};

export const deactivateVendor = async (
  client: SavetrixClient,
  vendorId: string,
): Promise<unknown> => {
  const res = await client.api.delete(`/quickbooks/vendors/${vendorId}`);
  return res.data;
};

export const reactivateVendor = async (
  client: SavetrixClient,
  vendorId: string,
): Promise<unknown> => {
  const res = await client.api.post(`/quickbooks/vendors/${vendorId}/reactivate`, {});
  return res.data;
};
