// Ported from Scantrix_v2 src/services/quickbooksService.ts (branch
// frontend-ui-v2). Linking.openURL (react-native) -> window.location.href,
// guarded for SSR. Hardcoded host moved to NEXT_PUBLIC_QUICKBOOKS_API_URL —
// see .env.local.example.
const QUICKBOOKS_API_URL =
  process.env.NEXT_PUBLIC_QUICKBOOKS_API_URL ||
  "https://scantrix-api-4bvpc76k6q-uc.a.run.app";

export const connectToQuickBooks = async () => {
  if (typeof window === "undefined") return;
  window.location.href = `${QUICKBOOKS_API_URL}/quickbooks/connect`;
};
