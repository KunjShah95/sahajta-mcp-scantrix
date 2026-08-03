import { unwrapList } from "./unwrap.js";
export const listAccounts = async (client) => {
    const res = await client.api.get("/quickbooks/accounts");
    return unwrapList(res, ["accounts"]);
};
export const createAccount = async (client, args) => {
    const res = await client.api.post("/quickbooks/accounts", {
        name: args.name,
        accountType: args.accountType,
        ...(args.accountSubType ? { accountSubType: args.accountSubType } : {}),
    });
    return res.data;
};
export const syncAccounts = async (client) => {
    const res = await client.api.post("/quickbooks/accounts/sync", {});
    return res.data;
};
