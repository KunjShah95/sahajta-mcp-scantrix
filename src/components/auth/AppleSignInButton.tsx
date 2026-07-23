// Apple Sign-In (web) is BLOCKED for this pass: it requires a Services ID
// plus web redirect URIs configured in Apple Developer, which the mobile
// app's native expo-apple-authentication setup does not provide either.
// Disabled/"Coming Soon" precedent, matching pickProfileImage's stub in
// src/store/auth/authApi.ts. See ASSUMPTIONS.md.
export function AppleSignInButton() {
  return (
    <button
      type="button"
      disabled
      title="Apple Sign-In requires a Services ID and web redirect URIs from Apple Developer — not available yet."
      className="inline-flex h-[50px] w-full cursor-not-allowed items-center justify-center rounded-md border border-border bg-background-alt text-body font-semibold text-text-secondary"
    >
      Continue with Apple (Coming Soon)
    </button>
  );
}
