"use client";

import Image from "next/image";
import {
  CSSProperties,
  HTMLAttributes,
  ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";

// Scroll-reveal hook: adds the settled state once an element scrolls into
// view, then stops observing. Falls back to visible when IntersectionObserver
// isn't available (SSR / old browsers) so content is never trapped hidden.
export function useReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      // Very old browsers: reveal on the next frame (deferred, not a
      // synchronous setState in the effect body) so nothing stays hidden.
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
          }
        }
      },
      { threshold: 0.14, rootMargin: "0px 0px -8% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, visible };
}

interface RevealProps extends HTMLAttributes<HTMLDivElement> {
  delay?: number;
  children: ReactNode;
}

// Convenience wrapper for the common "fade + rise into view" reveal.
export function Reveal({ delay = 0, className = "", style, children, ...props }: RevealProps) {
  const { ref, visible } = useReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={`lp-reveal ${visible ? "is-visible" : ""} ${className}`}
      style={{ ...(style as CSSProperties), ["--lp-delay" as string]: `${delay}ms` }}
      {...props}
    >
      {children}
    </div>
  );
}

// Above-the-fold entrance: CSS-only load animation (no IntersectionObserver),
// so hero content paints immediately and never depends on JS to become
// visible. Use this for the first screen; use Reveal for everything below.
export function LoadIn({ delay = 0, className = "", style, children, ...props }: RevealProps) {
  return (
    <div
      className={`lp-load ${className}`}
      style={{ ...(style as CSSProperties), ["--lp-delay" as string]: `${delay}ms` }}
      {...props}
    >
      {children}
    </div>
  );
}

// Small tracked-out section eyebrow. Teal accent, understated.
export function SectionLabel({
  children,
  tone = "teal",
  className = "",
}: {
  children: ReactNode;
  tone?: "teal" | "light";
  className?: string;
}) {
  const color = tone === "light" ? "text-[color:var(--lp-teal)]" : "text-[color:var(--lp-teal-700)]";
  return (
    <span
      className={`inline-flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.18em] ${color} ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--lp-teal)]" aria-hidden />
      {children}
    </span>
  );
}

// Real Scantrix app icon (public/scantrix-icon.png, sourced from the mobile
// app's assets/icon.png — its teal background is the exact hex of this app's
// --color-primary token) paired with the "Scantrix" text wordmark.
export function Wordmark({
  variant = "dark",
  className = "",
}: {
  variant?: "dark" | "light";
  className?: string;
}) {
  const textColor = variant === "light" ? "text-white" : "text-trust-navy";
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <Image
        src="/scantrix-icon.png"
        alt=""
        width={36}
        height={36}
        className="h-9 w-9 shrink-0 rounded-[11px] shadow-sm"
        priority
      />
      <span className={`text-[19px] font-bold tracking-[-0.02em] ${textColor}`}>Scantrix</span>
    </span>
  );
}
