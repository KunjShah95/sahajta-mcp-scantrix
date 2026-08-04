export const listPlans = async (client) => {
    const res = await client.api.get("/subscription/plans");
    return res.data;
};
export const getMySubscription = async (client) => {
    const res = await client.api.get("/subscription");
    return res.data;
};
export const choosePlan = async (client, args) => {
    const res = await client.api.post("/subscription/choose-plan", args);
    return res.data;
};
