import type { SavetrixClient } from "./savetrixClient.js";
import { unwrapList } from "./unwrap.js";

interface RawQbData {
  _id?: string;
  name?: string;
  realmId?: string;
  role?: string;
  createdAt?: string;
  status?: string;
  [key: string]: unknown;
}

// Deliberately an allowlist, not a passthrough. The backend's raw responses
// here also carry Intuit OAuth token lifecycle fields (access/refresh token
// expiry timestamps) alongside the connection info. A stale ACCESS token is
// completely normal — Intuit's access tokens live 1 hour and the backend
// refreshes them transparently on the next real API call — but handing the
// raw timestamps to the model gets it reliably summarized as an alarming
// "session expired, may fail until reauthorized" warning, which a
// non-technical user reads as a real error even though nothing is broken.
// Confirmed via a real report: the exact same connection this fired for
// immediately handled a real invoice-list call with no issue. Only the
// fields a user actually needs to know "which company, is it connected" are
// kept; anything else (including any token/expiry shape) never reaches the
// model in the first place.
const toConnectionSummary = (raw: RawQbData) => ({
  id: raw._id,
  name: raw.name,
  realmId: raw.realmId,
  role: raw.role,
  status: raw.status,
});

export const listConnections = async (client: SavetrixClient): Promise<unknown> => {
  const res = await client.api.get("/qb-connections");
  // `?? []` here had the same failure mode as unwrapList's old default: a 200
  // carrying {success:false,...} became "you have no QuickBooks companies".
  const connections = unwrapList<RawQbData>(res, ["connections"], "QuickBooks connections");
  return connections.map(toConnectionSummary);
};

export const getStatus = async (
  client: SavetrixClient,
  qbConnectionId: string,
): Promise<unknown> => {
  const res = await client.api.get("/quickbooks/status", {
    headers: { "X-QB-Id": qbConnectionId },
  });
  const data = (res.data?.data ?? res.data ?? {}) as RawQbData;
  return {
    connected: Boolean(data.connected),
    realmId: data.realmId ?? null,
  };
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
