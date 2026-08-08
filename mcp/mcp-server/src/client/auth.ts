import type { SavetrixClient } from "./savetrixClient.js";

export const getAccountInfo = async (client: SavetrixClient): Promise<unknown> => {
  const res = await client.api.get("/users/me");
  return res.data;
};

export const updateProfile = async (
  client: SavetrixClient,
  args: { userId?: string; firstName?: string; lastName?: string; phone?: string },
): Promise<unknown> => {
  if (!args.userId) {
    const session = client.session.load();
    const id = (session.user as any)?.data?.user?._id;
    if (!id) throw new Error("Cannot determine userId — log in first or pass userId.");
    args = { ...args, userId: id };
  }
  const { userId, ...fields } = args;
  // Non-null: the guard above either found it on args or filled it from the session.
  const res = await client.api.patch(`/users/${encodeURIComponent(userId!)}`, fields);
  return res.data;
};
