# ASSUMPTIONS.md

Every judgment call made in place of a missing stakeholder answer.
Append one line per decision as they're made during the loop.

## Seeded before loop start

- No PRD exists. Requirements source is the mobile app's actual code
  at ~/Scantrix_v2 (branch frontend-ui-v2), not a written spec.
- Working branch is `web-app-build` off `main`; nothing is pushed to
  `main` directly by the loop, and nothing is pushed to origin at all
  without human review after the loop stops (this repo currently has
  no PR-review workflow set up — that's a convention to confirm with
  the team, not something the loop should assume either way).
- Backend URLs, Firebase config, and all API contracts are reused
  exactly as they exist in the mobile app / already-ported logic
  layer — nothing about the backend integration is being redesigned,
  only the UI consuming it.
- Subscription pricing is fixed and not open for reinterpretation:
  Trial free/14 days/1 slot; Standard $15mo or $149yr/1 slot;
  Enterprise $30mo or $299yr/3 slots; all plans unlimited
  scans/team members.
- Google Drive integration and Delete Account both remain UI-only
  mockups/stubs in this pass — real backend work for both is
  out of scope tonight, not a decision the loop should second-guess
  or attempt to fully implement.
- Desktop UI is a genuine redesign of information architecture, not a
  1:1 visual port of mobile screens — mobile has no real tab bar, and
  desktop needs its own navigation shell. Colors, spacing, typography
  are ported exactly; layout/IA is not.

## A4 — theme token port

- Confirmed no tailwind.config.js exists in this scaffold (Tailwind v4,
  CSS-only config) — used the `@theme` block in src/app/globals.css as
  instructed.
- Spacing tokens are named `--space-xs`…`--space-xxl` per the task's
  literal naming, not `--spacing-*`. Tailwind v4 only auto-generates
  utility classes (p-*, gap-*, etc.) for the `--spacing-*` namespace,
  so these remain plain CSS custom properties used via
  `var(--space-md)` / arbitrary values (`p-[var(--space-md)]`), not
  auto-generated utilities. This matches the task's explicit example
  naming over utility-generation convenience.
- Typography tokens are named under Tailwind's real `--text-*`
  namespace (`--text-h1`, `--text-body`, …) — not explicitly specified
  by the task, but chosen (judgment call) so `text-h1` / `text-body-sm`
  utilities are auto-generated, consistent with how `--radius-*` was
  explicitly specified to work.
- Dropped the default create-next-app dark-mode (`prefers-color-scheme:
  dark`) background/foreground override that shipped in the scaffold's
  globals.css. The mobile app's theme/colors.ts has no dark-mode
  tokens at all — it's a light-only app — so the web port is light-only
  for now too, matching source exactly rather than inventing a dark
  theme. Tailwind's `dark:` variant utilities still work if a future
  task needs them; nothing was removed from Tailwind itself, only the
  scaffold's placeholder dark override.

## A6 — outbound send capability guard

- Grepped src/lib/ and src/store/ (the ported logic layer) for
  nodemailer/sendgrid/twilio/smtp/ses/sns/stripe/charge/sendEmail/
  sendSms/mailer. N/A — no outbound email/SMS/payment send capability
  exists in the ported logic layer, confirming what the earlier port
  pass already found in the mobile source. Nothing to gate or guard.
