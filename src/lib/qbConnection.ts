// Bridge between src/store/index.ts and src/lib/api.ts.
//
// api.ts's request interceptor needs the current qbConnectionId to attach
// the X-QB-Id header. Importing the store directly from api.ts would create
// a cycle: store/index.ts -> slices -> */Api.ts -> lib/api.ts -> store/index.ts.
// The React Native source dodged this with a lazy require("../store") inside
// the interceptor; that CommonJS pattern is fragile under Next.js's bundler
// for client-side code (webpack/Turbopack expect static ESM imports in app
// code and only special-case require() for actual CJS packages). This module
// breaks the cycle instead: store/index.ts pushes the value here on every
// state change, api.ts only ever reads it, and neither file imports the
// other.
let currentQbConnectionId: string | null = null;

export const setQbConnectionId = (id: string | null) => {
  currentQbConnectionId = id;
};

export const getQbConnectionId = () => currentQbConnectionId;
