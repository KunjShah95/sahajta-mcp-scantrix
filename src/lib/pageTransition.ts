// Same singleton-emitter pattern as dialogManager.ts — lets a component
// that's about to unmount (e.g. DashboardContent's "Recent" card, right
// before the user navigates to /invoices) hand a starting rect to
// ExpandTransitionOverlay (mounted inside AppShell, which never unmounts
// between route navigations) without React context plumbing between two
// route trees that are never mounted at the same time.
import EventEmitter from "eventemitter3";

export const pageTransitionEmitter = new EventEmitter();
export const EXPAND_TRANSITION_REQUEST = "EXPAND_TRANSITION_REQUEST";

export interface ExpandTransitionRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

// Captured synchronously at click-time, before the triggering element
// unmounts — the overlay reads this once it re-renders on the other side of
// the navigation.
export function requestExpandTransition(fromEl: HTMLElement): void {
  const domRect = fromEl.getBoundingClientRect();
  const rect: ExpandTransitionRect = {
    top: domRect.top,
    left: domRect.left,
    width: domRect.width,
    height: domRect.height,
  };
  pageTransitionEmitter.emit(EXPAND_TRANSITION_REQUEST, rect);
}
