import "dotenv/config";
import { loadConfig } from "./config.js";
import { runStdio } from "./servers/stdioServer.js";
import { runHttp } from "./servers/httpServer.js";
import { startRemote } from "./servers/remoteServer.js";

const main = async (): Promise<void> => {
  const config = loadConfig(process.argv.slice(2));
  if (config.remote) {
    startRemote(config);
    return;
  }
  if (!config.http) {
    await runStdio(config);
    return;
  }
  await runHttp(config);
};

main().catch((error) => {
  console.error("Fatal:", error instanceof Error ? error.message : error);
  process.exit(1);
});
