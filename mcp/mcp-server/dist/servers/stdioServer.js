import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { buildServer } from "../tools/index.js";
export const runStdio = async (config) => {
    const server = buildServer(config);
    const transport = new StdioServerTransport();
    await server.connect(transport);
};
