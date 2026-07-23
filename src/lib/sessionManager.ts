// Ported from Scantrix_v2 src/utils/sessionManager.ts (branch frontend-ui-v2).
// handleSessionExpired used React Navigation's navigation.reset(...) to send
// the user back to LoginScreen. This is a plain module (not a component), so
// it can't call Next's useRouter() hook — redirect via window.location
// instead. Guarded for SSR since this can be imported by server-rendered code
// paths even though it will only ever be invoked client-side.
import { clearStorage } from "./storage";

import EventEmitter from "eventemitter3";

export const sessionEmitter =
  new EventEmitter();

export const SESSION_EXPIRED =
  "SESSION_EXPIRED";

export const handleSessionExpired =
  async () => {
    await clearStorage();

    if (typeof window === "undefined") return;

    window.location.href = "/login?sessionExpired=true";
  };
