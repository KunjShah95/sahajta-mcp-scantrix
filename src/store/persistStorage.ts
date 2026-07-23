// redux-persist's default web storage (redux-persist/lib/storage) calls
// createWebStorage("local") at import time, which eagerly reads
// window.localStorage — that throws under Next.js SSR, where this module
// can be evaluated with no `window`. Swap in a promise-based no-op storage
// on the server; the real browser storage takes over once this module is
// evaluated client-side (see src/app/providers.tsx, the only place that
// actually starts persistence).
import createWebStorage from "redux-persist/lib/storage/createWebStorage";

const createNoopStorage = () => ({
  getItem(_key: string) {
    return Promise.resolve(null);
  },
  setItem(_key: string, value: string) {
    return Promise.resolve(value);
  },
  removeItem(_key: string) {
    return Promise.resolve();
  },
});

const persistStorage =
  typeof window !== "undefined" ? createWebStorage("local") : createNoopStorage();

export default persistStorage;
