import type { SavetrixClient } from "./savetrixClient.js";
import type { QBMemberRole } from "../types.js";

const qbIdOf = async (client: SavetrixClient): Promise<string> => {
  const id = await client.resolveQbId();
  if (!id) throw new Error("No active QuickBooks connection. Connect QuickBooks first.");
  return id;
};

export const listTeamMembers = async (client: SavetrixClient): Promise<unknown> => {
  const qbId = await qbIdOf(client);
  const res = await client.api.get(`/qb-connections/${encodeURIComponent(qbId)}/members`);
  return res.data;
};

export const inviteTeamMember = async (
  client: SavetrixClient,
  args: { email: string; role: QBMemberRole },
): Promise<unknown> => {
  const qbId = await qbIdOf(client);
  const res = await client.api.post(
    `/qb-connections/${encodeURIComponent(qbId)}/members`,
    { email: args.email, role: args.role },
  );
  return res.data;
};

export const removeTeamMember = async (
  client: SavetrixClient,
  memberId: string,
): Promise<unknown> => {
  const qbId = await qbIdOf(client);
  const res = await client.api.delete(`/qb-connections/${encodeURIComponent(qbId)}/members/${encodeURIComponent(memberId)}`);
  return res.data;
};

export const acceptTeamInvite = async (
  client: SavetrixClient,
  inviteToken: string,
): Promise<unknown> => {
  const res = await client.api.post("/qb-connections/invite/accept", { inviteToken });
  return res.data;
};
