export const getAccountInfo = async (client) => {
    const res = await client.api.get("/users/me");
    return res.data;
};
export const updateProfile = async (client, args) => {
    if (!args.userId) {
        const session = client.session.load();
        const id = session.user?.data?.user?._id;
        if (!id)
            throw new Error("Cannot determine userId — log in first or pass userId.");
        args = { ...args, userId: id };
    }
    const { userId, ...fields } = args;
    const res = await client.api.patch(`/users/${userId}`, fields);
    return res.data;
};
