// Ported from Scantrix_v2 src/services/api.ts (branch frontend-ui-v2).
// AsyncStorage -> localStorage. Every browser storage call is guarded
// individually since Next.js App Router can execute this module server-side.
import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { sessionEmitter, SESSION_EXPIRED } from "./sessionManager";
import { getQbConnectionId } from "./qbConnection";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.savetrix.com/api";

const readLocalStorage = (key: string): string | null => {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(key);
};

const writeLocalStorage = (key: string, value: string): void => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, value);
};

const removeLocalStorageKeys = (keys: string[]): void => {
  if (typeof window === "undefined") return;
  keys.forEach((key) => window.localStorage.removeItem(key));
};

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
});

// ==============================
// REQUEST INTERCEPTOR
// ==============================

api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    try {
      const token = readLocalStorage("accessToken");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      // Every QB-scoped endpoint (invoices, vendors, accounts, status, etc.)
      // requires X-QB-Id. Attach it here so individual API calls don't each
      // need to remember to pass it. Read via qbConnection.ts rather than
      // importing the store directly — see that file for why.
      if (!config.headers["X-QB-Id"]) {
        const qbConnectionId = getQbConnectionId();
        if (qbConnectionId) {
          config.headers["X-QB-Id"] = qbConnectionId;
        }
      }

      console.log("========== API REQUEST ==========");
      console.log(`${config.method?.toUpperCase()} ${BASE_URL}${config.url}`);
    } catch (error) {
      console.log("Error getting access token:", error);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ==============================
// RESPONSE INTERCEPTOR
// ==============================

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError | any) => {
    const originalRequest = error.config;

    console.log("========== API RESPONSE ERROR ==========");
    console.log(error);
    console.log(JSON.stringify(error?.response?.data, null, 2));

    // ==============================
    // ACCESS TOKEN EXPIRED
    // ==============================

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      // A token can expire between the server enforcing auth and us seeing
      // the response, so a POST/PATCH/DELETE that "failed" with 401 may
      // actually have been processed — re-sending it risks a duplicate record
      // (two bills in QuickBooks from one scan). So writes are never
      // re-sent. They still go through the refresh below, though: bailing out
      // before it left the access token expired and never emitted
      // SESSION_EXPIRED, so every subsequent write failed with a generic
      // error and the user was never told to sign in again.
      const method = (originalRequest.method || "get").toLowerCase();
      const isIdempotent = method === "get" || method === "head";

      try {
        const refreshToken = readLocalStorage("refreshToken");

        if (!refreshToken) {
          return Promise.reject(error);
        }

        const response = await axios.post(`${BASE_URL}/auth/refresh-token`, {
          refreshToken,
        });

        const newAccessToken = response.data.accessToken;

        writeLocalStorage("accessToken", newAccessToken);

        // Session is healthy again — but for a write, surface the original
        // error and let the caller decide whether to retry, rather than
        // repeating an operation the backend may already have committed.
        if (!isIdempotent) {
          return Promise.reject(error);
        }

        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

        return api(originalRequest);
      } catch (refreshError) {
        console.log("Refresh token failed:", refreshError);

        removeLocalStorageKeys(["accessToken", "refreshToken", "user"]);

        sessionEmitter.emit(SESSION_EXPIRED);

        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
