import Link from "next/link";
import { FileQuestion } from "lucide-react";

// Next.js renders this for every unmatched route, in place of its own
// unstyled default 404. Still passes through the root layout (Providers >
// AuthGate), so an unauthenticated visitor gets AuthGate's existing
// redirect-to-/login behavior for any non-public path exactly as it does
// today (unchanged) — this page is what an authenticated user sees for a
// broken/mistyped link, rendered inside the normal AppShell. See
// DESIGN_ASSUMPTIONS.md D4.2.
export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-[var(--space-lg)] text-center">
      <span className="mb-[var(--space-md)] flex h-16 w-16 items-center justify-center rounded-full bg-background-alt text-text-secondary">
        <FileQuestion size={32} strokeWidth={1.75} />
      </span>
      <p className="text-h2 font-bold text-trust-navy">Page not found</p>
      <p className="mt-[var(--space-xs)] max-w-sm text-body-sm text-text-secondary">
        The page you&apos;re looking for doesn&apos;t exist or may have moved.
      </p>
      <Link
        href="/dashboard"
        className="mt-[var(--space-lg)] rounded-md bg-primary px-[var(--space-lg)] py-[var(--space-sm)] font-bold text-text-primary hover:opacity-90"
      >
        Back to Dashboard
      </Link>
    </div>
  );
}
