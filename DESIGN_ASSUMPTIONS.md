# DESIGN_ASSUMPTIONS.md

Every research finding and judgment call made during tonight's design
pass. Append as they happen — a research citation belongs here BEFORE
the code that acted on it gets written, not after.

## Seeded before loop start

- Color palette is completely locked — client-approved, ported exactly
  from the mobile app. Every commit's gate includes a diff check on
  `src/app/globals.css`'s existing `--color-*` values against the D0.2
  snapshot below. New tokens may be added; no existing value changes.
- This pass is presentation-only. No changes inside `src/store/` or
  any `*Api.ts` file's request/data logic. The FormData/File upload
  fix from last night's loop is untouched except for its visual
  trigger (button/UI), never its data handling.
- Google Sign-In and Apple Sign-In issues are NOT code bugs and are
  explicitly out of scope for this loop to "fix" — see
  DESIGN_LOOP.md's guardrails. Google needs a Cloud Console origin
  allowlist change; Apple needs a Services ID from Apple Developer.
  Neither requires or permits a code change tonight.
- No autonomous Vercel deployment under any circumstance tonight, even
  if every task completes cleanly. Branch gets pushed to origin;
  deployment is a human decision after visual review.
- Any third-party brand logo used must come from a legitimately
  licensed source built for representing integrations — never scraped,
  never hand-approximated.

## D0.2 — Color token snapshot (reference for every later diff check)

Gate baseline confirmed green before any change: `npx tsc --noEmit`
exit 0, `npx next build` exit 0 (20 routes generated successfully).

Verbatim `--color-*` values from `src/app/globals.css` at loop start
(this is the byte-identical reference every later commit's color-diff
check compares against):

```
--color-primary: #1fb6aa;
--color-background: #ffffff;
--color-background-soft: #f8fafc;
--color-background-alt: #f7f8fa;
--color-trust-navy: #1f3a5f;
--color-text-primary: #0f172a;
--color-text-secondary: #475569;
--color-border: #e2e8f0;
--color-success: #16a34a;
--color-warning: #f59e0b;
--color-error: #dc2626;
--color-white: #ffffff;
--color-black: #000000;
```
