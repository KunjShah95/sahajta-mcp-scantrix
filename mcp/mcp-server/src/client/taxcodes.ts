import type { SavetrixClient } from "./savetrixClient.js";

export const listTaxCodes = async (client: SavetrixClient): Promise<unknown> => {
  const res = await client.api.get("/quickbooks/taxcodes");
  const payload = res.data?.data;
  return (
    payload?.items ||
    payload?.taxCodes ||
    payload?.taxcodes ||
    (Array.isArray(payload) ? payload : [])
  );
};

export const syncTaxCodes = async (client: SavetrixClient): Promise<unknown> => {
  const res = await client.api.post("/quickbooks/taxcodes/sync", {});
  return res.data;
};
