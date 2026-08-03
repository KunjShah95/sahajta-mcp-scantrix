import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
// The smoke test always exercises the built server in dist/.
const entry = resolve(process.cwd(), "dist/index.js");
if (!existsSync(entry)) {
    console.error("dist build not found. Run: npm run build");
    process.exit(1);
}
const child = spawn(process.execPath, [entry], {
    stdio: ["pipe", "pipe", "inherit"],
});
let buffer = "";
const messages = {};
let nextId = 1;
child.stdout.on("data", (chunk) => {
    buffer += chunk.toString();
    let idx;
    while ((idx = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line)
            continue;
        try {
            const msg = JSON.parse(line);
            if (msg?.id !== undefined)
                messages[msg.id] = msg;
        }
        catch {
            // ignore non-JSON lines
        }
    }
});
const send = (method, params, id) => {
    const msgId = id ?? nextId++;
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: msgId, method, params }) + "\n");
    return new Promise((resolveMsg, rejectMsg) => {
        const timeout = setTimeout(() => rejectMsg(new Error(`timeout waiting for ${method}`)), 10000);
        const poll = () => {
            if (messages[msgId]) {
                clearTimeout(timeout);
                resolveMsg(messages[msgId]);
            }
            else {
                setTimeout(poll, 20);
            }
        };
        poll();
    });
};
const fail = (msg) => {
    console.error(`SMOKE FAILED: ${msg}`);
    child.kill();
    process.exit(1);
};
const run = async () => {
    const init = await send("initialize", {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "smoke", version: "0.0.0" },
    }, 1);
    if (init.error)
        fail(`initialize error: ${JSON.stringify(init.error)}`);
    if (init.result?.serverInfo?.name !== "savetrix-mcp-server") {
        fail(`unexpected serverInfo: ${JSON.stringify(init.result?.serverInfo)}`);
    }
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
    const tools = await send("tools/list", undefined, 2);
    if (tools.error)
        fail(`tools/list error: ${JSON.stringify(tools.error)}`);
    const names = (tools.result?.tools ?? []).map((t) => t.name);
    for (const required of ["savetrix_login", "savetrix_invoice_list", "savetrix_invoice_post_to_qb"]) {
        if (!names.includes(required))
            fail(`missing tool ${required}`);
    }
    console.log(`SMOKE OK: ${names.length} tools listed, server info ${JSON.stringify(init.result.serverInfo)}`);
    child.kill();
    process.exit(0);
};
run().catch((error) => fail(error instanceof Error ? error.message : String(error)));
