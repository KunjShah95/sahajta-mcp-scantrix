import { existsSync, readFileSync } from "node:fs";

export interface Config {
  apiUrl: string;
  webUrl: string;
  port: number;
  http: boolean;
  email?: string;
  password?: string;
  qbConnectionId?: string;
  mcpApiKey?: string;
  configFilePath: string;
}

const DEFAULT_API_URL = "https://api.savetrix.com/api";
const DEFAULT_WEB_URL = "https://scantrix.ai";
const DEFAULT_PORT = 8000;
const DEFAULT_CONFIG_PATH = ".savetrix-mcp/config.json";

interface ConfigFile {
  accessToken?: string;
  refreshToken?: string;
  user?: unknown;
  email?: string;
  password?: string;
  qbConnectionId?: string;
}

export interface CliArgs {
  http: boolean;
  port?: number;
  configFilePath: string;
}

export const parseArgs = (argv: string[]): CliArgs => {
  let http = false;
  let port: number | undefined;
  let configFilePath = DEFAULT_CONFIG_PATH;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--http") {
      http = true;
    } else if (arg === "--port") {
      const raw = argv[++i];
      const parsed = Number(raw);
      if (!raw || !Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
        throw new Error(`Invalid --port value: ${raw}`);
      }
      port = parsed;
    } else if (arg === "--config") {
      configFilePath = argv[++i] || DEFAULT_CONFIG_PATH;
    }
  }
  return { http, port, configFilePath };
};

const readConfigFile = (path: string): ConfigFile => {
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf8")) as ConfigFile;
  } catch {
    return {};
  }
};

const envStr = (key: string): string | undefined => {
  const v = process.env[key];
  return v && v.trim() !== "" ? v.trim() : undefined;
};

export const loadConfig = (argv: string[]): Config => {
  const args = parseArgs(argv);
  const file = readConfigFile(args.configFilePath);

  const email = envStr("SAVETRIX_EMAIL") ?? file.email;
  const password = envStr("SAVETRIX_PASSWORD") ?? file.password;
  const qbConnectionId =
    envStr("SAVETRIX_QB_CONNECTION_ID") ?? file.qbConnectionId;

  return {
    apiUrl: envStr("SAVETRIX_API_URL") ?? DEFAULT_API_URL,
    webUrl: (envStr("SAVETRIX_WEB_URL") ?? DEFAULT_WEB_URL).replace(/\/$/, ""),
    port:
      args.port ??
      (envStr("SAVETRIX_PORT") ? Number(envStr("SAVETRIX_PORT")) : DEFAULT_PORT),
    http: args.http,
    email,
    password,
    qbConnectionId,
    mcpApiKey: envStr("SAVETRIX_MCP_API_KEY"),
    configFilePath: args.configFilePath,
  };
};
