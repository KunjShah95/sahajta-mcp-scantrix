"use client";

import Script from "next/script";
import { useRef, useState } from "react";

import { useAppDispatch } from "@/store/hooks";
import { appleLogin } from "@/store/auth/authApi";

declare global {
  interface Window {
    AppleID?: {
      auth: {
        init: (config: {
          clientId: string;
          scope: string;
          redirectURI: string;
          usePopup: boolean;
        }) => void;
        signIn: () => Promise<{
          authorization: { id_token: string; code: string; state?: string };
          user?: { email?: string; name?: { firstName?: string; lastName?: string } };
        }>;
      };
    };
  }
}

interface AppleSignInButtonProps {
  onSuccess: () => void;
  onError: (message: string) => void;
}

// Sign in with Apple JS, popup flow (usePopup: true) — same UX shape as
// Google/Microsoft's popup-based sign-in, no full-page redirect. Requires a
// Services ID (NEXT_PUBLIC_APPLE_CLIENT_ID) and a web Return URL registered
// against it in Apple Developer (Certificates, Identifiers & Profiles →
// Identifiers → Services IDs) — Apple validates redirectURI against that
// exact registration even in popup mode. Genuinely can't work until that
// Apple Developer setup exists (this was a hard "Coming Soon" stub before
// with zero SDK integration — see ASSUMPTIONS.md); wired up ahead of that
// setup so flipping the env vars on is the only remaining step.
export function AppleSignInButton({ onSuccess, onError }: AppleSignInButtonProps) {
  const dispatch = useAppDispatch();
  const [scriptReady, setScriptReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const initializedRef = useRef(false);

  const clientId = process.env.NEXT_PUBLIC_APPLE_CLIENT_ID;
  const redirectURI =
    process.env.NEXT_PUBLIC_APPLE_REDIRECT_URI || (typeof window !== "undefined" ? window.location.origin : "");

  const ensureInitialized = () => {
    if (initializedRef.current || !window.AppleID || !clientId) return;
    window.AppleID.auth.init({
      clientId,
      scope: "name email",
      redirectURI,
      usePopup: true,
    });
    initializedRef.current = true;
  };

  const handleClick = async () => {
    if (!clientId || loading) return;
    ensureInitialized();
    if (!window.AppleID) {
      onError("Apple Sign-In hasn't finished loading yet. Please try again in a moment.");
      return;
    }

    setLoading(true);
    try {
      const response = await window.AppleID.auth.signIn();
      const identityToken = response?.authorization?.id_token;
      if (!identityToken) {
        onError("Apple sign-in did not return an identity token.");
        return;
      }

      // Apple only returns name/email on the account's *first* authorization
      // — appleAuth on the backend falls back to the token's own email claim
      // (and an existing user record) when these come through empty on
      // repeat sign-ins, so "" here is a safe, expected default.
      const result = await dispatch(
        appleLogin({
          identityToken,
          firstName: response.user?.name?.firstName || "",
          lastName: response.user?.name?.lastName || "",
          email: response.user?.email || "",
        }),
      );

      if (appleLogin.fulfilled.match(result)) {
        onSuccess();
      } else {
        const payload = result.payload;
        onError(typeof payload === "string" ? payload : "Apple sign-in failed");
      }
    } catch (error: any) {
      // Fires when someone closes the popup themselves — not a real
      // failure, matching MicrosoftSignInButton's identical
      // user-cancelled handling.
      if (error?.error !== "popup_closed_by_user") {
        onError(error?.error || error?.message || "Apple sign-in failed");
      }
    } finally {
      setLoading(false);
    }
  };

  if (!clientId) {
    // No Services ID configured in this environment (the Apple Developer
    // setup this depends on doesn't exist yet) — same disabled/"Coming
    // Soon" precedent as Google/Microsoft above rather than a button that
    // would just fail on click.
    return (
      <button
        type="button"
        disabled
        title="Apple Sign-In requires a Services ID and web redirect URIs from Apple Developer — not available yet."
        className="inline-flex h-[50px] w-full cursor-not-allowed items-center justify-center rounded-md border border-border bg-background-alt text-body font-semibold text-text-secondary"
      >
        Continue with Apple (Coming Soon)
      </button>
    );
  }

  return (
    <>
      <Script
        src="https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js"
        strategy="afterInteractive"
        onReady={() => {
          setScriptReady(true);
          ensureInitialized();
        }}
      />
      <button
        type="button"
        onClick={handleClick}
        disabled={loading || !scriptReady}
        className="inline-flex h-[50px] w-full items-center justify-center rounded-md border border-border bg-white text-body font-semibold text-text-primary hover:bg-background-alt disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Signing in…" : "Continue with Apple"}
      </button>
    </>
  );
}
