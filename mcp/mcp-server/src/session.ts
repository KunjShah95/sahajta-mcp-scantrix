import { chmod, mkdir, rm, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { dirname } from "node:path";

export interface SessionData {
  accessToken?: string;
  refreshToken?: string;
  user?: unknown;
  email?: string;
  password?: string;
}

export class SessionStore {
  constructor(private readonly filePath: string) {}

  load(): SessionData {
    try {
      const raw = readFileSync(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as SessionData;
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  async save(data: Partial<SessionData>): Promise<void> {
    const merged: SessionData = { ...this.load(), ...data };
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(merged, null, 2), {
      mode: 0o600,
    });
    try {
      await chmod(this.filePath, 0o600);
    } catch {
      // best effort — Windows may not support chmod
    }
  }

  async clear(): Promise<void> {
    await rm(this.filePath, { force: true });
  }
}

/**
 * In-memory session for the remote (multi-user) server: each request builds a
 * client seeded from the caller's OAuth token, so nothing is persisted to disk.
 */
export class MemorySessionStore extends SessionStore {
  private data: SessionData;

  constructor(initial: SessionData = {}) {
    super("");
    this.data = { ...initial };
  }

  load(): SessionData {
    return { ...this.data };
  }

  async save(data: Partial<SessionData>): Promise<void> {
    this.data = { ...this.data, ...data };
  }

  async clear(): Promise<void> {
    this.data = {};
  }
}
