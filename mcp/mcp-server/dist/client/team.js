const qbIdOf = async (client) => {
    const id = await client.resolveQbId();
    if (!id)
        throw new Error("No active QuickBooks connection. Connect QuickBooks first.");
    return id;
};
export const listTeamMembers = async (client) => {
    const qbId = await qbIdOf(client);
    const res = await client.api.get(`/qb-connections/${encodeURIComponent(qbId)}/members`);
    return res.data;
};
export const inviteTeamMember = async (client, args) => {
    const qbId = await qbIdOf(client);
    const res = await client.api.post(`/qb-connections/${encodeURIComponent(qbId)}/members`, { email: args.email, role: args.role });
    return res.data;
};
export const removeTeamMember = async (client, memberId) => {
    const qbId = await qbIdOf(client);
    const res = await client.api.delete(`/qb-connections/${encodeURIComponent(qbId)}/members/${encodeURIComponent(memberId)}`);
    return res.data;
};
export const acceptTeamInvite = async (client, inviteToken) => {
    const res = await client.api.post("/qb-connections/invite/accept", { inviteToken });
    return res.data;
};
