import type { Metadata } from "next";

import { LandingPage } from "@/components/landing/LandingPage";

// AuthGate (src/components/auth/AuthGate.tsx) renders this marketing landing
// page for logged-out visitors at "/", and redirects authenticated ones to
// /dashboard before it is ever shown — see its root-route logic.
export const metadata: Metadata = {
  title: "Scantrix — Invoices, posted to QuickBooks automatically",
  description:
    "Scantrix reads every invoice, matches the vendor in QuickBooks, and posts the bill — so accountants and small-business teams only review the exceptions. Start free for 14 days.",
};

export default function RootPage() {
  return <LandingPage />;
}
