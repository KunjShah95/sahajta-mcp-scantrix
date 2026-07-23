"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { restoreUser } from "@/store/auth/authSlice";
import { getUser } from "@/lib/storage";

// Routes reachable regardless of auth state. /invite/accept and
// /register/verify-otp both have their own internal auth-aware logic
// (see their page components) — they are not simply "logged-out only".
const PUBLIC_ROUTES = ["/login", "/register", "/register/verify-otp", "/invite/accept"];

const AUTH_ONLY_REDIRECT_ROUTES = ["/login", "/register"];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

function FullScreenLoader() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-[var(--space-md)] bg-background-soft">
      <span
        aria-hidden
        className="h-10 w-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary"
      />
      <p className="text-body-sm font-medium text-text-secondary">Loading…</p>
    </div>
  );
}

// Ported from Scantrix_v2 App.tsx's AppContent restoreSession() effect +
// SplashScreen's redirect logic, combined: on the web there is no native
// splash screen, so this component's initial loading state does that job
// (see STATUS.md row 1).
export function AuthGate({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const pathname = usePathname();
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const savedUser = await getUser();
      if (!cancelled && savedUser) {
        dispatch(restoreUser(savedUser));
      }
      if (!cancelled) setRestoring(false);
    })();
    return () => {
      cancelled = true;
    };
    // Only ever needs to run once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (restoring) return;
    if (!isAuthenticated && !isPublicRoute(pathname)) {
      router.replace("/login");
    } else if (isAuthenticated && AUTH_ONLY_REDIRECT_ROUTES.includes(pathname)) {
      router.replace("/dashboard");
    }
  }, [restoring, isAuthenticated, pathname, router]);

  if (restoring) return <FullScreenLoader />;

  // Avoid flashing protected/auth-only content for the tick before the
  // redirect effect above actually navigates away.
  if (!isAuthenticated && !isPublicRoute(pathname)) return <FullScreenLoader />;
  if (isAuthenticated && AUTH_ONLY_REDIRECT_ROUTES.includes(pathname)) return <FullScreenLoader />;

  return <>{children}</>;
}
