import { unwrapList } from "./unwrap.js";
export const listVendors = async (client, status) => {
    const res = await client.api.get("/quickbooks/vendors", {
        params: status === "inactive" ? { status: "inactive" } : {},
    });
    return unwrapList(res, ["vendors"]);
};
export const createVendor = async (client, args) => {
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
export const updateVendor = async (client, args) => {
    const { vendorId, ...fields } = args;
    const body = {};
    for (const key of ["displayName", "currency", "email", "phone", "address", "glAccountId", "taxCodeId"]) {
        if (fields[key] !== undefined)
            body[key] = fields[key];
    }
    const res = await client.api.patch(`/quickbooks/vendors/${vendorId}`, body);
    return res.data;
};
export const deactivateVendor = async (client, vendorId) => {
    const res = await client.api.delete(`/quickbooks/vendors/${vendorId}`);
    return res.data;
};
export const reactivateVendor = async (client, vendorId) => {
    const res = await client.api.post(`/quickbooks/vendors/${vendorId}/reactivate`, {});
    return res.data;
};
