"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAppDispatch } from "@/store/hooks";
import { googleLogin } from "@/store/auth/authApi";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: Record<string, unknown>,
          ) => void;
        };
      };
    };
  }
}

interface GoogleSignInButtonProps {
  onSuccess: () => void;
  onError: (message: string) => void;
}

// Web client ID found hardcoded as `webClientId` in Scantrix_v2's
// LoginScreen.tsx / CreateAccountScreen.tsx — see ASSUMPTIONS.md (A7) for
// why this is a genuine Google OAuth Web-application client, and for the
// Cloud Console "Authorized JavaScript origins" caveat that applies here.
export function GoogleSignInButton({ onSuccess, onError }: GoogleSignInButtonProps) {
  const dispatch = useAppDispatch();
  const buttonRef = useRef<HTMLDivElement>(null);
  const [scriptReady, setScriptReady] = useState(false);

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  // Callers commonly pass onSuccess/onError as fresh inline closures on every
  // render (e.g. LoginForm/RegisterForm rebuild them each keystroke since
  // they're plain consts / inline arrows, not useCallback). Reading them via
  // refs instead of depending on them directly keeps handleCredential's
  // identity — and therefore the init effect below — stable across those
  // renders. Without this, google.accounts.id.initialize()/renderButton()
  // re-ran on every keystroke in the surrounding form, tearing down and
  // rebuilding the button and visibly shifting the page layout each time.
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
  }, [onSuccess, onError]);

  const handleCredential = useCallback(
    async (response: { credential: string }) => {
      const result = await dispatch(googleLogin({ idToken: response.credential }));
      if (googleLogin.fulfilled.match(result)) {
        onSuccessRef.current();
      } else {
        const payload = result.payload;
        onErrorRef.current(typeof payload === "string" ? payload : "Google sign-in failed");
      }
    },
    [dispatch],
  );

  useEffect(() => {
    if (!scriptReady || !clientId || !window.google || !buttonRef.current) return;
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: handleCredential,
    });
    window.google.accounts.id.renderButton(buttonRef.current, {
      theme: "outline",
      size: "large",
      width: 320,
      text: "continue_with",
    });
  }, [scriptReady, clientId, handleCredential]);

  if (!clientId) {
    // No client ID configured in this environment — render the same
    // disabled/"Coming Soon" precedent as pickProfileImage
    // (src/store/auth/authApi.ts) rather than a broken button.
    return (
      <button
        type="button"
        disabled
        className="inline-flex h-[50px] w-full cursor-not-allowed items-center justify-center rounded-md border border-border bg-background-alt text-body font-semibold text-text-secondary"
      >
        Continue with Google (Coming Soon)
      </button>
    );
  }

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
      />
      <div ref={buttonRef} className="flex w-full justify-center" />
    </>
  );
}
