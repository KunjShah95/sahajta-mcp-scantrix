"use client";

import { useRef } from "react";

interface RefreshLimit {
  windowMs: number;
  max: number;
}

// Caps how often a manual "refresh from QuickBooks" button can actually
// fire a sync call — each click hits a real external API, so a user
// double-clicking or mashing the button shouldn't spam it. Auto-refreshes
// (initial load, focus refetch, etc.) never call attempt() themselves, so
// they're excluded by construction rather than needing an "isManual" flag
// threaded through every call site.
const DEFAULT_LIMITS: RefreshLimit[] = [
  { windowMs: 60_000, max: 2 },
  { windowMs: 120_000, max: 5 },
];

export function useRefreshThrottle(limits: RefreshLimit[] = DEFAULT_LIMITS) {
  const attemptsRef = useRef<number[]>([]);

  // Call once per manual refresh click. Returns null (and records the
  // attempt) when allowed, or the number of seconds to wait when blocked.
  return function attempt(): number | null {
    const now = Date.now();
    const longestWindowMs = Math.max(...limits.map((limit) => limit.windowMs));
    attemptsRef.current = attemptsRef.current.filter((t) => now - t < longestWindowMs);

    for (const limit of limits) {
      const timestampsInWindow = attemptsRef.current.filter((t) => now - t < limit.windowMs);
      if (timestampsInWindow.length >= limit.max) {
        const oldestInWindow = Math.min(...timestampsInWindow);
        return Math.ceil((limit.windowMs - (now - oldestInWindow)) / 1000);
      }
    }

    attemptsRef.current.push(now);
    return null;
  };
}
