export const listConnections = async (client) => {
    const res = await client.api.get("/qb-connections");
    return res.data?.data?.connections ?? [];
};
export const getStatus = async (client, qbConnectionId) => {
    const res = await client.api.get("/quickbooks/status", {
        headers: { "X-QB-Id": qbConnectionId },
    });
    return res.data?.data ?? res.data;
};
export const getConnectUrl = async (client, redirectAfter) => {
    const res = await client.api.get("/quickbooks/connect", {
        params: redirectAfter ? { redirectAfter } : {},
    });
    const authUrl = res.data?.data?.authUrl;
    if (!authUrl)
        throw new Error("QuickBooks connect returned no authUrl.");
    return authUrl;
};
export const disconnect = async (client, qbConnectionId) => {
    const res = await client.api.delete("/quickbooks/disconnect", {
        headers: { "X-QB-Id": qbConnectionId },
    });
    return res.data;
};
