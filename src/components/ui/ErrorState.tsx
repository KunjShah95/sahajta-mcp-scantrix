import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/Button";

// One shared error-state shape for "this list/page failed to load" —
// distinct from DialogHost's toast/confirm system, which is for one-off
// action feedback, not a persistent section of the page. Per
// DESIGN_ASSUMPTIONS.md D2.2 research: errors need an announced message
// (role="alert") and a clear recovery action (retry), not a dead end.
export function ErrorState({
  message = "Something went wrong while loading this. Please try again.",
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div role="alert" className="flex flex-col items-center px-[var(--space-lg)] py-[var(--space-xl)] text-center">
      <span className="mb-[var(--space-md)] flex h-16 w-16 items-center justify-center rounded-full bg-error/10">
        <AlertTriangle size={28} strokeWidth={1.75} className="text-error" />
      </span>
      <p className="text-h3 font-bold text-text-primary">Couldn&apos;t load this</p>
      <p className="mt-[var(--space-xs)] max-w-sm text-body-sm text-text-secondary">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-[var(--space-lg)]">
          Try again
        </Button>
      )}
    </div>
  );
}
