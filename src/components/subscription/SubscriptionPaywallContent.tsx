"use client";

import { useRouter } from "next/navigation";

// Mock 402-style block preview, ported verbatim from Scantrix_v2
// src/screens/subscription/SubscriptionPaywallScreen.tsx — no real gating.
const MOCK_BLOCK = {
  reasonCode: "SUBSCRIPTION_REQUIRED",
  title: "Subscription Required",
  message: "Your trial has ended. Upgrade to a paid plan to keep scanning invoices and syncing with QuickBooks.",
};

export function SubscriptionPaywallContent() {
  const router = useRouter();

  const handleUpgrade = () => {
    window.alert("Preview only — full subscription flow coming soon.");
  };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <div className="flex h-14 items-center px-[var(--space-md)]">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-background-soft text-text-primary"
        >
          ✕
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-[var(--space-xl)] text-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-4xl">🔒</span>

        <span className="mt-[var(--space-md)] rounded-pill bg-error/10 px-[var(--space-sm)] py-1 text-[10px] font-bold tracking-wide text-error">
          {MOCK_BLOCK.reasonCode}
        </span>

        <h1 className="mt-[var(--space-md)] text-h2 font-bold text-trust-navy">{MOCK_BLOCK.title}</h1>
        <p className="mt-[var(--space-sm)] max-w-sm text-body-sm text-text-secondary">{MOCK_BLOCK.message}</p>

        <button
          type="button"
          onClick={handleUpgrade}
          className="mt-[var(--space-xl)] w-full max-w-sm rounded-lg bg-primary py-[var(--space-sm)] font-bold text-white"
        >
          Upgrade Now
        </button>
        <button type="button" onClick={() => router.back()} className="mt-[var(--space-sm)] font-semibold text-text-secondary">
          Maybe Later
        </button>
      </div>
    </div>
  );
}
