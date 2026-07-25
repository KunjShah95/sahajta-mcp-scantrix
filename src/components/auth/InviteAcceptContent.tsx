"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { acceptQBInvite } from "@/store/quickBooks/quickBooksApi";
import { savePendingInviteToken } from "@/lib/storage";
import { useLogout } from "@/store/useLogout";
import { Spinner } from "@/components/ui/Spinner";

type ScreenStatus = "checking" | "redirecting" | "accepting" | "success" | "error";

export function InviteAcceptContent() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const searchParams = useSearchParams();
  const logout = useLogout();
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);

  const inviteToken = searchParams.get("token");

  const [status, setStatus] = useState<ScreenStatus>("checking");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const run = async () => {
      if (!inviteToken) {
        router.replace("/login");
        return;
      }

      if (!isAuthenticated) {
        setStatus("redirecting");
        await savePendingInviteToken(inviteToken);
        router.replace("/login?fromInvite=true");
        return;
      }

      setStatus("accepting");
      const result = await dispatch(acceptQBInvite({ inviteToken }));

      if (acceptQBInvite.fulfilled.match(result)) {
        setStatus("success");
        router.replace("/dashboard");
        return;
      }

      const payload = result.payload as { message?: string } | undefined;
      setErrorMessage(payload?.message || "This invite link is invalid or has expired.");
      setStatus("error");
    };

    run();
    // Only run once per mount — re-running on every isAuthenticated flicker
    // (e.g. token refresh) would re-trigger the accept call unnecessarily.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background-soft px-[var(--space-lg)]">
      <div className="w-full max-w-sm rounded-2xl bg-white p-[var(--space-xl)] text-center shadow-sm">
        {(status === "checking" || status === "redirecting" || status === "accepting") && (
          <>
            <Spinner size="lg" className="mx-auto block" />
            <p className="mt-[var(--space-md)] text-h3 font-bold text-text-primary">
              {status === "redirecting" ? "Almost there…" : "Verifying your invite…"}
            </p>
            <p className="mt-[var(--space-xs)] text-body-sm text-text-secondary">
              {status === "redirecting" ? "Please log in to accept your invite." : "Hang tight while we confirm your invite."}
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
              <CheckCircle2 size={32} strokeWidth={1.75} className="text-success" />
            </span>
            <p className="mt-[var(--space-md)] text-h3 font-bold text-text-primary">Invite accepted</p>
            <p className="mt-[var(--space-xs)] text-body-sm text-text-secondary">Taking you to your dashboard…</p>
          </>
        )}

        {status === "error" && (
          <>
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-error/10">
              <XCircle size={32} strokeWidth={1.75} className="text-error" />
            </span>
            <p className="mt-[var(--space-md)] text-h3 font-bold text-text-primary">Couldn&apos;t accept invite</p>
            <p className="mt-[var(--space-xs)] text-body-sm text-text-secondary">{errorMessage}</p>

            <button
              type="button"
              onClick={() => router.replace("/dashboard")}
              className="mt-[var(--space-lg)] h-12 w-full rounded-md bg-primary font-bold text-white"
            >
              Go to Dashboard
            </button>
            <button
              type="button"
              onClick={logout}
              className="mt-[var(--space-sm)] font-semibold text-primary"
            >
              Try logging in again
            </button>
          </>
        )}
      </div>
    </div>
  );
}
