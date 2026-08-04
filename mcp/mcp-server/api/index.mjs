// Vercel serverless entry for the Savetrix remote MCP connector.
// Exports the Express app (OAuth authorization server + /mcp) as the handler.
// Required env vars on Vercel:
//   SAVETRIX_PUBLIC_URL   = https://<your-project>.vercel.app
//   SAVETRIX_TOKEN_SECRET = <random string, >= 32 chars>
// Optional: SAVETRIX_API_URL, SAVETRIX_WEB_URL
import "dotenv/config";
import { loadConfig } from "../dist/config.js";
import { createRemoteApp } from "../dist/servers/remoteServer.js";

const config = loadConfig(["--remote"]);
export default createRemoteApp(config);
