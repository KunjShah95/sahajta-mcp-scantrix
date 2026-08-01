import type { AxiosResponse } from "axios";

/** Returns the first array found under data.data.<key> for the given keys. */
export const unwrapList = <T = unknown>(
  res: AxiosResponse,
  keys: string[],
): T[] => {
  const payload = res.data?.data ?? res.data;
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === "object") {
    for (const key of keys) {
      if (Array.isArray(payload[key])) return payload[key] as T[];
    }
  }
  return [];
};

/** Returns the first object found under data.data.<key>, else the whole body. */
export const unwrapOne = <T = unknown>(
  res: AxiosResponse,
  keys: string[],
): T => {
  const payload = res.data?.data ?? res.data;
  if (payload && typeof payload === "object") {
    for (const key of keys) {
      if (payload[key] !== undefined && payload[key] !== null) return payload[key] as T;
    }
  }
  return (res.data ?? {}) as T;
};

export const getPagination = (res: AxiosResponse): Record<string, unknown> | undefined => {
  return res.data?.data?.pagination;
};
