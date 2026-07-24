// Same singleton-emitter pattern as sessionManager.ts's sessionEmitter — a
// plain module (not a component) can trigger a dialog/toast from anywhere
// (event handlers, hooks like useLogout) without needing React context
// plumbing at every call site. src/components/ui/DialogHost.tsx is the one
// mounted subscriber that turns these events into rendered UI.
import EventEmitter from "eventemitter3";

export type DialogTone = "default" | "destructive";
export type ToastTone = "success" | "error" | "info";

export interface ConfirmRequest {
  id: number;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  tone: DialogTone;
  resolve: (value: boolean) => void;
}

export interface ToastRequest {
  id: number;
  message: string;
  tone: ToastTone;
}

export const dialogEmitter = new EventEmitter();

export const CONFIRM_REQUEST = "CONFIRM_REQUEST";
export const TOAST_REQUEST = "TOAST_REQUEST";

let nextId = 0;

// Replaces window.confirm — preserves the same blocking-until-dismissed
// contract (callers `await` this exactly like they awaited the synchronous
// window.confirm return value) but resolves on the themed dialog's button
// click instead of a native browser dialog.
export function confirmDialog(options: {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: DialogTone;
}): Promise<boolean> {
  return new Promise((resolve) => {
    const request: ConfirmRequest = {
      id: ++nextId,
      title: options.title,
      message: options.message,
      confirmLabel: options.confirmLabel ?? "Confirm",
      cancelLabel: options.cancelLabel ?? "Cancel",
      tone: options.tone ?? "default",
      resolve,
    };
    dialogEmitter.emit(CONFIRM_REQUEST, request);
  });
}

// Replaces window.alert for non-confirmation notices (success/error/info).
// Auto-dismisses — per DESIGN_LOOP.md's research requirement this loop
// looked up toast conventions before building: transient feedback should
// auto-dismiss (3-5s), unlike a confirmation which must stay until the user
// decides. See DESIGN_ASSUMPTIONS.md D1.3.
export function showToast(message: string, tone: ToastTone = "info"): void {
  const request: ToastRequest = { id: ++nextId, message, tone };
  dialogEmitter.emit(TOAST_REQUEST, request);
}
