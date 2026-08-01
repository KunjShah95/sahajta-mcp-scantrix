export const listTaxCodes = async (client) => {
    const res = await client.api.get("/quickbooks/taxcodes");
    const payload = res.data?.data;
    return (payload?.items ||
        payload?.taxCodes ||
        payload?.taxcodes ||
        (Array.isArray(payload) ? payload : []));
};
export const syncTaxCodes = async (client) => {
    const res = await client.api.post("/quickbooks/taxcodes/sync", {});
    return res.data;
};
