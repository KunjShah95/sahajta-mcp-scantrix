import { unwrapList } from "./unwrap.js";
export const listTaxCodes = async (client) => {
    const res = await client.api.get("/quickbooks/taxcodes");
    // /quickbooks/taxcodes wraps its payload as data.items rather than
    // data.taxcodes like the other list endpoints, so all three spellings are
    // accepted. This used to `|| []` its way past every unrecognized body,
    // which turned an upstream failure into "you have no tax codes".
    return unwrapList(res, ["items", "taxCodes", "taxcodes"], "tax codes");
};
export const syncTaxCodes = async (client) => {
    const res = await client.api.post("/quickbooks/taxcodes/sync", {});
    return res.data;
};
