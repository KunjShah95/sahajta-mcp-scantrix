import { chmod, mkdir, rm, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { dirname } from "node:path";
export class SessionStore {
    filePath;
    constructor(filePath) {
        this.filePath = filePath;
    }
    load() {
        try {
            const raw = readFileSync(this.filePath, "utf8");
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === "object" ? parsed : {};
        }
        catch {
            return {};
        }
    }
    async save(data) {
        const merged = { ...this.load(), ...data };
        await mkdir(dirname(this.filePath), { recursive: true });
        await writeFile(this.filePath, JSON.stringify(merged, null, 2), {
            mode: 0o600,
        });
        try {
            await chmod(this.filePath, 0o600);
        }
        catch {
            // best effort — Windows may not support chmod
        }
    }
    async clear() {
        await rm(this.filePath, { force: true });
    }
}
