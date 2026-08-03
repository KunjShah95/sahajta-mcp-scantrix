import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { Config } from "../config.js";
import { buildServer } from "../tools/index.js";

export const runStdio = async (config: Config): Promise<void> => {
  const server = buildServer(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
};
