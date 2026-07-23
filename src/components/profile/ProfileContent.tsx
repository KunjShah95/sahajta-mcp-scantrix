"use client";

import { useState } from "react";

// This page is built incrementally: C10 (this pass) adds only the Delete
// Account entry point below. C19 extends this same file with the rest of
// ProfileOptionsScreen's hub (profile summary card, Settings/Legal/Support
// sections, Logout) — see ASSUMPTIONS.md.
export function ProfileContent() {
  const [isDeleting, setIsDeleting] = useState(false);

  // Matches ProfileOptionsScreen.tsx's handleDeleteAccountPress exactly:
  // a real confirmation dialog, but the delete action itself is a
  // "Coming Soon" stub — no backend endpoint exists (flagged separately as
  // a real compliance requirement needing scoped backend work, per
  // TASKS.md's Pre-Marked BLOCKED list).
  const handleDeleteAccount = () => {
    if (isDeleting) return;
    if (
      !window.confirm(
        "Delete Account Permanently?\n\nThis action cannot be undone. Your account will be deleted permanently.",
      )
    ) {
      return;
    }
    setIsDeleting(true);
    window.alert("Coming Soon: Delete account API will be integrated next.");
    setIsDeleting(false);
  };

  return (
    <div className="mx-auto max-w-2xl p-[var(--space-lg)]">
      <h1 className="text-h2 font-bold text-trust-navy">Account</h1>

      <p className="mb-[var(--space-sm)] mt-[var(--space-lg)] text-caption font-bold uppercase tracking-wide text-text-secondary">
        Account Actions
      </p>
      <div className="overflow-hidden rounded-lg border border-border bg-white shadow-sm">
        <button
          type="button"
          onClick={handleDeleteAccount}
          disabled={isDeleting}
          className="flex w-full items-center gap-[var(--space-sm)] p-[var(--space-md)] text-left disabled:opacity-60"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-error/10 text-error">
            🗑
          </span>
          <span className="font-semibold text-error">{isDeleting ? "Deleting…" : "Delete Account"}</span>
        </button>
      </div>
    </div>
  );
}
