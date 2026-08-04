import type { SavetrixClient } from "./savetrixClient.js";

export const listConnections = async (client: SavetrixClient): Promise<unknown> => {
  const res = await client.api.get("/qb-connections");
  return res.data?.data?.connections ?? [];
};

export const getStatus = async (
  client: SavetrixClient,
  qbConnectionId: string,
): Promise<unknown> => {
  const res = await client.api.get("/quickbooks/status", {
    headers: { "X-QB-Id": qbConnectionId },
  });
  return res.data?.data ?? res.data;
};

export const getConnectUrl = async (
  client: SavetrixClient,
  redirectAfter?: string,
): Promise<string> => {
  const res = await client.api.get("/quickbooks/connect", {
    params: redirectAfter ? { redirectAfter } : {},
  });
  const authUrl = res.data?.data?.authUrl;
  if (!authUrl) throw new Error("QuickBooks connect returned no authUrl.");
  return authUrl;
};

export const disconnect = async (
  client: SavetrixClient,
  qbConnectionId: string,
): Promise<unknown> => {
  const res = await client.api.delete("/quickbooks/disconnect", {
    headers: { "X-QB-Id": qbConnectionId },
  });
  return res.data;
};
