// Shared between systemPrompt.ts (instructs the model to emit this exact
// sentence when it wants the user to confirm a destructive action) and
// ChatPanel.tsx (detects the sentence in a completed assistant message to
// trigger the app's real confirmDialog() instead of relying on the user
// noticing it and typing "yes" back). Plain string, safe in both the server
// and client bundles.
export const CONFIRM_MARKER = "Reply yes to confirm, or no to cancel.";
