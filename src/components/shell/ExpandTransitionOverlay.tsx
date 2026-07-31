"use client";

import { RefObject, useEffect, useRef, useState } from "react";

import { EXPAND_TRANSITION_REQUEST, ExpandTransitionRect, pageTransitionEmitter } from "@/lib/pageTransition";

const TRANSITION_MS = 420;

// Mounted once inside AppShell (which never remounts between route
// navigations) so it can animate *across* a navigation — by the time the
// destination page (e.g. Invoices) has mounted, the triggering element
// (e.g. Dashboard's Recent card) is already gone, but this overlay lives
// the whole time and just grows a plain card from the start rect to cover
// `targetRef` (the <main> content area), giving the illusion that the
// Recent card expanded into the new page.
export function ExpandTransitionOverlay({ targetRef }: { targetRef: RefObject<HTMLElement | null> }) {
  const [rect, setRect] = useState<ExpandTransitionRect | null>(null);
  const [targetRect, setTargetRect] = useState<ExpandTransitionRect | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const handleRequest = (fromRect: ExpandTransitionRect) => {
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (prefersReducedMotion) return;

      clearTimeout(timeoutRef.current);
      setTargetRect(null);
      setRect(fromRect);

      // Two rAFs: one lets the browser commit+paint the starting rect, the
      // second measures `targetRef` and flips to it on the next frame —
      // collapsing this into a single rAF risks the browser batching both
      // style writes into one frame, which skips the transition entirely.
      // The measurement happens here (an event callback), not in the render
      // body, since reading a ref's value during render isn't safe.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const target = targetRef.current?.getBoundingClientRect();
          if (target) {
            setTargetRect({ top: target.top, left: target.left, width: target.width, height: target.height });
          }
        });
      });

      timeoutRef.current = setTimeout(() => {
        setRect(null);
        setTargetRect(null);
      }, TRANSITION_MS);
    };

    pageTransitionEmitter.on(EXPAND_TRANSITION_REQUEST, handleRequest);
    return () => {
      pageTransitionEmitter.off(EXPAND_TRANSITION_REQUEST, handleRequest);
      clearTimeout(timeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!rect) return null;

  const style = targetRect
    ? { top: targetRect.top, left: targetRect.left, width: targetRect.width, height: targetRect.height, opacity: 0 }
    : { top: rect.top, left: rect.left, width: rect.width, height: rect.height, opacity: 1 };

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed z-50 rounded-lg border border-border bg-white shadow-lg transition-all ease-out"
      style={{ ...style, transitionDuration: `${TRANSITION_MS}ms` }}
    />
  );
}
