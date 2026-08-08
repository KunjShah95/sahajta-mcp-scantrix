"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { CONFIRM_REQUEST, ConfirmRequest, dialogEmitter } from "@/lib/dialogManager";
import { Button } from "@/components/ui/Button";

// Single global subscriber for src/lib/dialogManager.ts's emitter — mounted
// once in Providers so every route (including auth pages) can call
// confirmDialog() from a plain event handler with no context wiring at the
// call site. Replaces window.confirm; see DESIGN_ASSUMPTIONS.md D1.3.
// showToast() is handled separately by NotificationBell (preview bubble +
// dropdown history) — this host used to also render a bottom-corner toast
// for the same event, which meant every showToast() call showed up twice on
// screen at once; that duplicate rendering was removed here.
export function DialogHost() {
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onConfirm = (request: ConfirmRequest) => setConfirmRequest(request);
    dialogEmitter.on(CONFIRM_REQUEST, onConfirm);
    return () => {
      dialogEmitter.off(CONFIRM_REQUEST, onConfirm);
    };
  }, []);

  useEffect(() => {
    if (confirmRequest) confirmButtonRef.current?.focus();
  }, [confirmRequest]);

  const settle = (value: boolean) => {
    confirmRequest?.resolve(value);
    setConfirmRequest(null);
  };

  return (
    <>
      {confirmRequest && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          aria-describedby="confirm-dialog-message"
          className="fixed inset-0 z-[100] flex cursor-pointer items-center justify-center bg-black/40 p-[var(--space-lg)]"
          onClick={() => settle(false)}
          onKeyDown={(e) => e.key === "Escape" && settle(false)}
        >
          <div
            className="w-full max-w-sm cursor-auto rounded-lg bg-white p-[var(--space-lg)] shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-[var(--space-sm)]">
              {confirmRequest.tone === "destructive" && (
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-error/10">
                  <AlertTriangle size={20} strokeWidth={2} className="text-error" />
                </span>
              )}
              <div className="min-w-0">
                <h2 id="confirm-dialog-title" className="text-h3 font-bold text-text-primary">
                  {confirmRequest.title}
                </h2>
                <p id="confirm-dialog-message" className="mt-[var(--space-xs)] whitespace-pre-line text-body-sm text-text-secondary">
                  {confirmRequest.message}
                </p>
              </div>
            </div>

            <div className="mt-[var(--space-lg)] flex justify-end gap-[var(--space-sm)]">
              <Button variant="outline" size="sm" onClick={() => settle(false)}>
                {confirmRequest.cancelLabel}
              </Button>
              <Button
                ref={confirmButtonRef}
                variant={confirmRequest.tone === "destructive" ? "danger" : "primary"}
                size="sm"
                onClick={() => settle(true)}
              >
                {confirmRequest.confirmLabel}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
