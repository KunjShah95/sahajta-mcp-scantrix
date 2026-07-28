import type { Metadata } from "next";

import { LandingPage } from "@/components/landing/LandingPage";

// AuthGate (src/components/auth/AuthGate.tsx) renders this marketing landing
// page at "/" for every visitor, logged in or not — it's the one route that
// doesn't redirect authenticated users away, so it can still be previewed
// without logging out first. See its root-route logic.
export const metadata: Metadata = {
  title: "Scantrix — Invoices, posted to QuickBooks automatically",
  description:
    "Scantrix reads every invoice, matches the vendor in QuickBooks, and posts the bill — so accountants and small-business teams only review the exceptions. Start free for 14 days.",
};

export default function RootPage() {
  return <LandingPage />;
}
