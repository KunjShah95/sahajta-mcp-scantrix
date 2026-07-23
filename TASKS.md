# TASKS.md — Expense-Management-web-app

Repo: ~/Expense-Management-web-app (this working directory)
Mobile source (read-only, requirements source): ~/Scantrix_v2, branch
frontend-ui-v2

## Phase A — Safety Net & Foundation

- [x] A1: Confirm `git status` is clean at start. Create and check out
      branch `web-app-build` from `main` (current tip 7fe0015). All
      subsequent work happens on this branch, never on `main`.
- [ ] A2: `git fetch origin` — confirm no new commits exist on origin
      that aren't in local `main` yet. Do NOT merge or push anything
      in this task. If fetch fails (permissions/network), mark
      BLOCKED(reason), it's harmless, continue.
- [ ] A3: Gate baseline — run `npx tsc --noEmit && npx next build` on
      the current tree before touching anything. Confirm both exit 0
      (this has already been verified once manually; re-confirm it's
      still true at loop start). If either fails, fix before
      proceeding to any other task.
- [ ] A4: Read src/theme/colors.ts, spacing.ts, typography.ts,
      radius.ts from ~/Scantrix_v2 (frontend-ui-v2). Port them into
      this project as Tailwind v4 CSS custom properties inside
      src/app/globals.css, using an `@theme` block (this scaffold uses
      Tailwind v4 with no tailwind.config.js — confirm that's still
      true before choosing the porting mechanism; if a config file
      exists, use it instead and note why in ASSUMPTIONS.md). Name the
      tokens clearly (e.g. `--color-primary`, `--color-trust-navy`,
      `--space-xs` … `--space-xxl`, `--radius-sm` … `--radius-pill`)
      so every future screen references these tokens, not hardcoded
      hex values — the mobile app itself was inconsistent about this
      (DashboardScreen used the tokens, newer screens hardcoded hex);
      do not repeat that inconsistency here.
- [ ] A5: Build a small reusable UI primitives set in
      src/components/ui/: Button, Card, Input, Badge, at minimum —
      each using the tokens from A4, not one-off Tailwind classes per
      screen. Server Components by default; mark `'use client'` only
      on the ones that need it (e.g. Button if it takes an onClick).
- [ ] A6: Dry-run guard check — grep the ported logic layer
      (src/lib/, src/store/) for any outbound email/SMS/payment send
      capability. None is expected to exist (none was found in the
      mobile source during the earlier port). Confirm and record
      "N/A — no outbound send capability in ported logic" in
      ASSUMPTIONS.md rather than skipping this silently.
- [ ] A7: Create `.env.local` (gitignored, never committed) populated
      with the real values already known to work: the Firebase config
      already hardcoded in src/lib/firebase/config.ts, and
      NEXT_PUBLIC_API_URL / NEXT_PUBLIC_QUICKBOOKS_API_URL matching
      the values already used as fallbacks in src/lib/api.ts and
      src/lib/quickbooks/*.ts. If a Postman collection or .env file
      exists in ~/Scantrix_v2 (check `postman/` and `.postman/`
      directories, and search for any committed .env* file) with
      additional real values not yet known (e.g. a Google web OAuth
      client ID), pull them in. If the Google web client ID is
      genuinely absent from every source checked, mark it BLOCKED —
      do not fabricate one.

## Phase B — Self-Audit (Gap Mapping)

- [ ] B1: Enumerate every screen under ~/Scantrix_v2's
      src/screens/**/*.tsx (frontend-ui-v2). For each, write one row
      in STATUS.md: screen name, mobile file path, one-line summary
      of what it does, and its status in THIS repo (MISSING for all
      of them at this point, since no screens exist yet beyond the
      default page.tsx). Append one feature task to Phase C below for
      every MISSING screen that Phase C doesn't already explicitly
      cover — Phase C is a best-effort pre-enumeration, not
      guaranteed exhaustive; this task is what makes coverage
      complete.

## Phase C — Feature Tasks

- [ ] C1: Auth pages — /login and /register (or /create-account,
      match mobile's routing intent). Email/password fields wired to
      the already-ported `loginUser`/`registerUser` thunks. Google
      Sign-In button: if a real web OAuth client ID was found in A7,
      wire it via Google Identity Services JS SDK, posting the
      resulting idToken to the already-ported `googleLogin` thunk
      (which expects exactly `{ idToken: string }`); if no client ID
      exists, render the button in a disabled/"Coming soon" state with
      a code comment explaining why, exactly matching the
      `pickProfileImage` stub precedent already in this codebase
      (src/store/auth/authApi.ts). Same treatment for Apple Sign-In —
      it is almost certainly BLOCKED tonight (requires a Services ID
      and web redirect URIs configured in Apple Developer, which the
      mobile app's native `expo-apple-authentication` setup does not
      provide). Reference: Scantrix_v2 src/screens/auth/LoginScreen.tsx,
      CreateAccountScreen.tsx for field sets and copy.
- [ ] C2: Auth gate — a layout-level check that redirects
      unauthenticated users to /login and authenticated users away
      from /login, using the already-ported `getUser()` /
      `isAuthenticated` state. Keep this logic in a small Client
      Component wrapper, not the root layout itself.
- [ ] C3: Dashboard page (/dashboard or /) — greeting header, pending
      review count, auto-posted/manually-posted/failed counts, recent
      invoices list, and an upload trigger. Adaptation: mobile's
      camera/gallery/PDF action sheet becomes a file input
      (`<input type="file" accept="image/*,.pdf">`) since desktop web
      has no camera-first interaction pattern — record this as a
      judgment call in ASSUMPTIONS.md, it's a real UX decision being
      made without stakeholder input. Wire to the already-ported
      `getInvoices` thunk. Reference: DashboardScreen.tsx.
- [ ] C4: Invoice review page — display extracted fields
      (vendor, amounts, dates, line items), allow editing, post via
      the already-ported `postInvoiceToQuickBooks` /
      `updateInvoiceExtractedData` thunks. Reference:
      InvoiceReviewScreen.tsx.
- [ ] C5: Vendor resolution page — candidate vendor list from
      `fetchQuickBooksVendors`, resolve/create flow using
      `createQuickBooksVendor`. Reference: VendorResolutionScreen.tsx.
- [ ] C6: QuickBooks connect page — "Connect QuickBooks" using the
      already-ported `connectToQuickBooks` (redirects via
      window.location.href), status display via
      `getQuickBooksStatus`/`getMyQBConnections`.
- [ ] C7: Team members page — invite (email + role picker:
      admin/accountant/contributor), member list, remove-with-confirm,
      using the already-ported `inviteQBMember`/`fetchQBMembers`/
      `removeQBMember` thunks. Reference: TeamMembersScreen.tsx.
- [ ] C8: Invite-accept page (/invite/accept) reading a `token` query
      param, using the already-ported `acceptQBInvite` thunk.
      Reference: InviteAcceptScreen.tsx.
- [ ] C9: Profile / Accounting Softwares page — QuickBooks card
      (real), Tally and Zoho Books cards in disabled "Coming Soon"
      state (exact match to mobile), Google Drive card: a real OAuth
      connect button if credentials allow, storing connected state
      client-side only (no backend endpoint exists for this — do NOT
      build one, this was already scoped as a mockup on mobile and
      stays a mockup here). Reference: AccountingSoftwaresScreen.tsx.
- [ ] C10: Delete Account entry point in profile settings — build the
      UI (button, confirmation dialog shell) but keep it a clear
      "Coming Soon" / disabled state, matching the mobile stub
      exactly. Do NOT implement real account deletion — no backend
      endpoint exists, and this is a known stakeholder-gated item
      (flagged in an earlier App Store audit of the mobile app as a
      real compliance requirement that needs scoped backend work, not
      a tonight decision).
- [ ] C11: Subscription pages — Plans page (Trial free/14 days 1 slot,
      Standard $15/mo or $149/yr 1 slot, Enterprise $30/mo or $299/yr
      3 slots, all unlimited scans/team members, monthly/yearly
      toggle), Subscription status page (mock current plan/billing
      date/slot usage), paywall preview. Pure UI, no real billing
      calls, tapping any plan/upgrade action shows "Preview only —
      full subscription flow coming soon" exactly matching the mobile
      mockup precedent. Use the exact numbers above, nothing else.
- [ ] C12: Global app shell — top nav or sidebar navigation
      appropriate for a desktop layout. The mobile app has no real
      tab bar (confirmed during investigation — MainTabNavigator is a
      single-screen stack despite its name), so this is genuinely new
      information architecture, not a port of an existing pattern.
      Record this as a judgment call in ASSUMPTIONS.md. Link every
      page built in C1–C11 into this shell.

## Phase D — Docs & Close-out

- [ ] D1: README.md — what this repo is, how it maps to Scantrix_v2's
      mobile source, required env vars (reference .env.local.example),
      every BLOCKED/stubbed item and why.
- [ ] D2: Write FINAL_REPORT.md per LOOP.md's stop condition.

## Pre-Marked BLOCKED (credential- or stakeholder-gated)

- Google Sign-In (web) — needs a Google OAuth 2.0 Web application
  client ID, not present in any source checked as of Phase A.
- Apple Sign-In (web) — needs a Services ID + web redirect URIs
  configured in Apple Developer, not present.
- Google Drive real file import/browsing — no backend endpoint exists;
  stays a connect-only UI mockup by design, not a tonight gap.
- Delete Account (real implementation) — no backend endpoint exists;
  flagged separately as a real compliance requirement needing scoped
  backend work.
- Real payment/Stripe/IAP billing — explicitly out of scope (Phase 2
  in the original subscription design doc); Plans page stays a
  mockup.
- Vercel deployment — human decision after review, never a loop task.
