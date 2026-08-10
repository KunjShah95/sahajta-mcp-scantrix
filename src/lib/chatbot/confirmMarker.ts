// Shared between systemPrompt.ts (instructs the model to emit this exact
// sentence when it wants the user to confirm a destructive action) and
// ChatPanel.tsx (detects the sentence in a completed assistant message to
// trigger the app's real confirmDialog() instead of relying on the user
// noticing it and typing "yes" back). Plain string, safe in both the server
// and client bundles.
export const CONFIRM_MARKER = "Reply yes to confirm, or no to cancel.";

// Out-of-band channel for the consent ticket, server -> client. Deliberately
// NOT part of any tool schema and never shown to the model: the ticket is the
// thing that proves "the user was shown exactly this operation", so letting
// the model hold it would let it mint and spend its own consent. U+001F (unit
// separator) cannot occur in model prose, so the client can strip the line
// unambiguously before rendering.
export const CONSENT_FRAME_PREFIX = "\u001fSAVETRIX_CONSENT:";
export const CONSENT_FRAME_SUFFIX = "\u001f";
