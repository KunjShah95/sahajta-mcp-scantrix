import axios, { AxiosInstance, InternalAxiosRequestConfig } from "axios";
import { SessionStore, MemorySessionStore } from "../session.js";
import type { Config } from "../config.js";

interface RetryConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

interface LoginResponse {
  data: {
    accessToken: string;
    refreshToken: string;
    [key: string]: unknown;
  };
}

export class SavetrixClient {
  readonly api: AxiosInstance;
  readonly session: SessionStore;
  readonly baseURL: string;
  readonly webUrl: string;
  private accessToken?: string;
  private refreshToken?: string;
  private qbOverride?: string;
  private activeQbId?: string;
  private resolvingQb = false;

  constructor(opts: {
    baseURL: string;
    webUrl?: string;
    session: SessionStore;
    axiosInstance?: AxiosInstance;
    qbOverride?: string;
  }) {
    this.baseURL = opts.baseURL;
    this.webUrl = (opts.webUrl ?? "https://scantrix.ai").replace(/\/$/, "");
    this.session = opts.session;
    this.qbOverride = opts.qbOverride;

    const initial = opts.session.load();
    this.accessToken = initial.accessToken;
    this.refreshToken = initial.refreshToken;

    this.api = opts.axiosInstance ?? axios.create({ baseURL: this.baseURL, timeout: 30000 });

    this.api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
      if (this.accessToken) {
        config.headers.Authorization = `Bearer ${this.accessToken}`;
      }
      if (!config.headers["X-QB-Id"]) {
        const qbId = await this.resolveQbId();
        if (qbId) config.headers["X-QB-Id"] = qbId;
      }
      return config;
    });

    this.api.interceptors.response.use(
      (response) => response,
      async (error) => {
        const original = error.config as RetryConfig | undefined;
        if (error.response?.status === 401 && original && !original._retry) {
          original._retry = true;
          try {
            if (!this.refreshToken) {
              throw new Error(
                "Not logged in. Run the savetrix_login tool or set SAVETRIX_EMAIL/SAVETRIX_PASSWORD.",
              );
            }
            // Use this.api so the request matches the configured baseURL, but
            // mark it _retry so a 401 on refresh itself won't recurse here.
            const { data } = await this.api.post(
              "/auth/refresh-token",
              { refreshToken: this.refreshToken },
              { _retry: true } as RetryConfig,
            );
            const newAccessToken: string | undefined = data?.accessToken;
            if (!newAccessToken) {
              throw new Error("Session expired. Run savetrix_login again.");
            }
            this.accessToken = newAccessToken;
            await this.session.save({ accessToken: newAccessToken });
            original.headers.Authorization = `Bearer ${newAccessToken}`;
            return this.api(original);
          } catch (refreshError) {
            if (refreshError instanceof Error && /login/i.test(refreshError.message)) {
              return Promise.reject(refreshError);
            }
            return Promise.reject(
              new Error("Session expired. Run the savetrix_login tool again."),
            );
          }
        }
        return Promise.reject(error);
      },
    );
  }

  setTokens(accessToken: string, refreshToken: string): void {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
  }

  getAccessToken(): string | undefined {
    return this.accessToken;
  }

  getRefreshToken(): string | undefined {
    return this.refreshToken;
  }

  setActiveQbId(id: string): void {
    this.activeQbId = id;
  }

  getActiveQbId(): string | undefined {
    return this.activeQbId ?? this.qbOverride;
  }

  async resolveQbId(): Promise<string | undefined> {
    if (this.activeQbId) return this.activeQbId;
    if (this.qbOverride) return this.qbOverride;
    if (!this.accessToken) return undefined;
    // Prevent re-entrancy: the /qb-connections request below re-runs the
    // request interceptor, which would call resolveQbId again and recurse.
    if (this.resolvingQb) return undefined;
    this.resolvingQb = true;
    try {
      const res = await this.api.get("/qb-connections");
      const connections = res.data?.data?.connections;
      const first = Array.isArray(connections) ? connections[0] : undefined;
      if (first?._id) {
        this.activeQbId = first._id;
        return this.activeQbId;
      }
    } catch {
      // no connection yet — QB-scoped calls will fail with a clear backend error
    } finally {
      this.resolvingQb = false;
    }
    return undefined;
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    const res = await this.api.post("/auth/login", { email, password });
    const payload = res.data as LoginResponse;
    const d = payload?.data;
    if (!d?.accessToken || !d?.refreshToken) {
      throw new Error("Login response missing accessToken/refreshToken.");
    }
    this.setTokens(d.accessToken, d.refreshToken);
    await this.session.save({
      accessToken: d.accessToken,
      refreshToken: d.refreshToken,
      user: payload,
      email,
    });
    return payload;
  }

  async logout(): Promise<void> {
    try {
      if (this.refreshToken) {
        await this.api.post("/auth/logout", { refreshToken: this.refreshToken });
      }
    } finally {
      this.accessToken = undefined;
      this.refreshToken = undefined;
      this.activeQbId = undefined;
      await this.session.clear();
    }
  }
}

export const createClient = (config: Config): SavetrixClient =>
  new SavetrixClient({
    baseURL: config.apiUrl,
    webUrl: config.webUrl,
    session: new SessionStore(config.configFilePath),
    qbOverride: config.qbConnectionId,
  });

/**
 * Build a client for a single remote request, seeded with the Savetrix tokens
 * carried inside the caller's verified OAuth access token. Uses an in-memory
 * session so nothing touches disk (safe for serverless / multi-user).
 */
export const createClientForTokens = (
  config: Config,
  tokens: { accessToken: string; refreshToken: string },
): SavetrixClient => {
  const client = new SavetrixClient({
    baseURL: config.apiUrl,
    webUrl: config.webUrl,
    session: new MemorySessionStore(tokens),
    qbOverride: config.qbConnectionId,
  });
  client.setTokens(tokens.accessToken, tokens.refreshToken);
  return client;
};
