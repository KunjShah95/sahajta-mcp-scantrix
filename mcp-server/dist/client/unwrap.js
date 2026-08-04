/** Returns the first array found under data.data.<key> for the given keys. */
export const unwrapList = (res, keys) => {
    const payload = res.data?.data ?? res.data;
    if (Array.isArray(payload))
        return payload;
    if (payload && typeof payload === "object") {
        for (const key of keys) {
            if (Array.isArray(payload[key]))
                return payload[key];
        }
    }
    return [];
};
/** Returns the first object found under data.data.<key>, else the whole body. */
export const unwrapOne = (res, keys) => {
    const payload = res.data?.data ?? res.data;
    if (payload && typeof payload === "object") {
        for (const key of keys) {
            if (payload[key] !== undefined && payload[key] !== null)
                return payload[key];
        }
    }
    return (res.data ?? {});
};
export const getPagination = (res) => {
    return res.data?.data?.pagination;
};
