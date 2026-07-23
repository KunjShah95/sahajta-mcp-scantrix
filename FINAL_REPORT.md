# FINAL_REPORT.md

Written at the end of the autonomous build loop defined in `LOOP.md`,
per its Stop Condition. Every box in `TASKS.md` is checked — nothing is
BLOCKED at the task level (some individual *features within* completed
tasks are intentionally stubbed; see "Blocked items" below).

Branch: `web-app-build`, off `main` (tip `be109d9` at start, which
includes `7fe0015`'s logic-layer port). 27 commits, one per task, in
order — `git log main..web-app-build` is the authoritative build
history. Nothing was pushed to `origin`; that is a human decision after
review, per `LOOP.md`.

## What was built, per feature

### Phase A — Foundation
- **A1–A3**: Branch setup, origin-fetch confirmation, gate baseline
  confirmed green before any code changes.
- **A4**: Design tokens ported from Scantrix_v2's `theme/` into a
  Tailwind v4 `@theme` block. `src/app/globals.css`.
- **A5**: UI primitives — Button, Card, Input, Badge — built on those
  tokens. `src/components/ui/{Button,Card,Input,Badge,index}.tsx`.
- **A6**: Confirmed no outbound email/SMS/payment-send capability
  exists in the ported logic layer (grep-verified).
- **A7**: `.env.local` populated with real values, including a real
  Google OAuth Web client ID found in the mobile source (see
  "Blocked items" below for the one caveat this creates).

### Phase B — Self-audit
- **B1**: All 19 mobile screens inventoried in `STATUS.md`. Found 7
  screens not explicitly named by the original Phase C task list and
  appended tasks C13–C19 for them.

### Phase C — Features (all 19 tasks complete)

| Task | Route(s) | Key files |
|---|---|---|
| C1 | `/login`, `/register` | `src/components/auth/{LoginForm,RegisterForm,GoogleSignInButton,AppleSignInButton}.tsx` |
| C2 | (layout-level) | `src/components/auth/AuthGate.tsx` |
| C3 | `/dashboard` | `src/components/dashboard/DashboardContent.tsx` |
| C4 | `/invoices/[id]/review` | `src/components/invoices/InvoiceReviewContent.tsx` |
| C5 | `/invoices/[id]/vendor` | `src/components/invoices/VendorResolutionContent.tsx` |
| C6 | `/quickbooks` | `src/components/quickbooks/QuickBooksConnectContent.tsx` |
| C7 | `/team` | `src/components/team/TeamMembersContent.tsx` |
| C8 | `/invite/accept` | `src/components/auth/InviteAcceptContent.tsx` |
| C9 | `/accounting-software` | `src/components/accounting/AccountingSoftwaresContent.tsx` |
| C10 | `/profile` (Delete Account section) | `src/components/profile/ProfileContent.tsx` |
| C11 | `/plans`, `/subscription`, `/paywall` | `src/components/subscription/{PlansContent,SubscriptionStatusContent,SubscriptionPaywallContent}.tsx` |
| C12 | (layout-level) | `src/components/shell/AppShell.tsx`, `src/store/useLogout.ts` |
| C13 | `/register/verify-otp` | `src/components/auth/VerifyOtpContent.tsx` |
| C14 | `/invoices?type=` | `src/components/invoices/InvoiceListContent.tsx` |
| C15 | `/invoices/[id]` | `src/components/invoices/InvoiceDetailContent.tsx` |
| C16 | `/invoices/preview` | `src/components/invoices/InvoicePreviewContent.tsx` |
| C17 | `/invoices/pending` | `src/components/invoices/PendingInvoicesContent.tsx` |
| C18 | `/profile/edit` | `src/components/profile/EditProfileContent.tsx` |
| C19 | `/profile` (rest of the hub) | `src/components/profile/ProfileContent.tsx` |

Shared support code built along the way: `src/store/hooks.ts` (typed
Redux hooks), `src/lib/countryCodes.ts`, `src/lib/currencies.ts`,
`src/lib/invoiceDisplay.ts`, `src/lib/invoiceReviewTheme.ts`,
`src/lib/invoiceDetailTheme.ts`.

### Phase D — Docs
- **D1**: `README.md` rewritten (was still the create-next-app
  default).
- **D2**: This file.

### Two real cross-platform bugs found and fixed (not judgment calls)

Both were inherited from the earlier logic-layer port (commit
`7fe0015`) and would have silently corrupted uploads the first time a
real browser hit them — an RN-only `FormData` shape (`{uri, name,
type}`, requires RN's polyfill) where a real `File`/`Blob` is required:

1. `scanInvoice` — `src/store/invoice/invoiceApi.ts` (found while
   wiring C3's upload trigger).
2. `updateProfileIcon` — `src/store/auth/authApi.ts` (found while
   wiring C18's photo upload; also had a manually-set, boundary-less
   `multipart/form-data` Content-Type header that would additionally
   break the upload).

## Gate status

Every task's commit was gated on `npx tsc --noEmit && npx next build`
both exiting 0. Final state: 20 routes build clean, 7 static/prerendered,
3 dynamic (`/invoices/[id]`, `/invoices/[id]/review`,
`/invoices/[id]/vendor`). A dev-server smoke pass (`next dev`, curl
against all 20 routes) returned 200 with no server-side errors on
every route as a final holistic check beyond the per-task gate.

**Not done in this loop, by design**: real interactive browser testing
(clicking through forms, verifying visual layout, confirming OAuth
round-trips against the live backend). `LOOP.md` scopes this loop's
gate to compile/build correctness only and explicitly reserves
live-backend and visual verification for a human. See README.md and
the "Blocked items" section below for exactly what to check first.

## ASSUMPTIONS.md, verbatim

Every judgment call made in place of a missing stakeholder answer.
Append one line per decision as they're made during the loop.

### Seeded before loop start

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

### A4 — theme token port

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

### A6 — outbound send capability guard

- Grepped src/lib/ and src/store/ (the ported logic layer) for
  nodemailer/sendgrid/twilio/smtp/ses/sns/stripe/charge/sendEmail/
  sendSms/mailer. N/A — no outbound email/SMS/payment send capability
  exists in the ported logic layer, confirming what the earlier port
  pass already found in the mobile source. Nothing to gate or guard.

### A7 — .env.local population, and reversing the Google Sign-In pre-mark

- Populated NEXT_PUBLIC_API_URL / NEXT_PUBLIC_QUICKBOOKS_API_URL from
  the hardcoded fallbacks already in src/lib/api.ts and
  src/lib/quickbooks/{connect,postInvoice}.ts — no new info, just made
  real.
- Added NEXT_PUBLIC_FIREBASE_* vars mirroring src/lib/firebase/
  config.ts's hardcoded firebaseConfig object, for documentation
  parity per the task wording. NOTE: config.ts itself still reads
  these values inline (hardcoded), not from process.env — it was not
  refactored, since the task only asked to populate .env.local with
  these already-known values, not to change how config.ts sources
  them. If a future task wants config.ts to read from env instead,
  that's a separate, explicit decision.
- **Reversing the Pre-Marked BLOCKED item for Google Sign-In (web):**
  found a real Google OAuth Web-application client ID —
  `244169573027-ttt4i12jqi1coi0hhk90saslrra76t4a.apps.googleusercontent.com`
  — hardcoded as `webClientId` in both Scantrix_v2
  src/screens/auth/LoginScreen.tsx and CreateAccountScreen.tsx (passed
  to `GoogleSignin.configure`). `@react-native-google-signin/
  google-signin`'s own contract requires `webClientId` to be a client
  of type WEB, never Android/iOS, specifically so it can be used for
  backend/cross-platform ID-token verification — meaning this is a
  genuine Google Cloud Console "Web application" OAuth client, not a
  mobile-only credential. It has not been fabricated; it was found
  verbatim in the source the task told this loop to trust.
  Consequence: C1 will do REAL Google Identity Services (GIS) JS SDK
  wiring using this client ID (per the task's own contingency: "if a
  real web OAuth client ID was found in A7, wire it"), not a stub.
  CAVEAT flagged for a human: this client ID's "Authorized JavaScript
  origins" allowlist in Google Cloud Console was almost certainly
  configured for the mobile app's ID-token-verification use case,
  which does not require an origins allowlist at all. Browser-based
  GIS sign-in DOES enforce an origins allowlist at runtime. A human
  with Google Cloud Console access to project `scantrix-3d179` (or
  wherever this OAuth client lives) needs to add this web app's
  origin(s) — e.g. `http://localhost:3000` for local dev and the real
  production domain — to that client's allowed JavaScript origins, or
  the sign-in call will fail with an origin-mismatch error at runtime.
  This is a Google Cloud Console configuration task, not a code gap;
  the wiring itself is complete and correct.
- Apple Sign-In (web) pre-mark stands as BLOCKED — nothing found in
  A7's search changes that; it genuinely needs a Services ID + web
  redirect URIs from Apple Developer that don't exist anywhere in the
  checked sources.

### Cross-cutting — React Native `Alert.alert` → browser dialogs

- Applies to every screen ported from here on (Login, Register,
  ProfileOptions, TeamMembers, etc.). Mobile screens consistently use
  React Native's `Alert.alert(...)` for two different jobs: (1)
  terminal API-failure notices, and (2) destructive-action
  confirmations (logout, delete account, remove team member). Field-
  level validation, by contrast, is always inline error text under
  the input, never an Alert — that split is preserved exactly.
  For (1) and (2), this port uses the browser's native `window.alert`
  / `window.confirm` rather than pulling in a toast/dialog library:
  it needs no new dependency, and it's the closest behavioral match
  to a blocking native alert (execution pauses until dismissed, same
  as `Alert.alert`). It looks like a plain browser dialog rather than
  a themed in-app one — a real, judgment-call visual regression from
  the mobile app's styled alert boxes, accepted here rather than
  adding a dependency for it. If a themed dialog is wanted later,
  swap these call sites for a small in-house dialog component; every
  call site is a plain, easy-to-find `window.alert`/`window.confirm`.

### C3 — Dashboard page

- **Real bug fix, not a judgment call:** the logic-layer port's
  `scanInvoice` thunk (src/store/invoice/invoiceApi.ts) built its
  FormData with a React-Native-only `{uri, name, type}` object shape
  (from RN's FormData polyfill). A real browser's FormData.append
  requires an actual File/Blob — the RN shape would have silently
  uploaded garbage (`[object Object]`, coerced via toString()) the
  first time any web screen tried to scan an invoice. Fixed to accept
  a browser `File` directly and append it properly. This is a
  necessary correction surfaced by actually wiring a working upload
  UI, not a redesign.
- QuickBooks company switcher: mobile puts this dropdown inside
  DashboardScreen's own header (mobile has no persistent global nav,
  so every screen owns its own header). This port's dashboard page
  intentionally does NOT reimplement that dropdown — C12's global app
  shell is a genuinely new, persistent piece of navigation chrome
  (already flagged as a judgment call in the "Seeded before loop
  start" section above), and a company switcher belongs there once it
  exists, not duplicated per-page. Until C12 lands, there is no
  in-app UI to switch QuickBooks companies; `qbConnectionId` still
  defaults correctly via `getMyQBConnections` on first load.
  [[C12]]
- Consolidated per-status theming (auto/manual/pending/processing/
  failed → label + colors) and invoice title/amount/failure-reason
  formatting into src/lib/invoiceDisplay.ts. Mobile re-implemented
  this THEME_CONFIG object separately in DashboardScreen,
  InvoiceListScreen, and InvoiceDetailsScreen (with mismatched exact
  hex values between them) — one shared source here instead, reused
  again by C14/C15/C17.
- Dashboard's "recent invoices" cards are not click-through, matching
  mobile exactly: DashboardScreen's `InvoiceCard` wraps in a
  `TouchableOpacity` with no `onPress` handler bound — already
  non-interactive on mobile, not a web-port omission.

### C4 — Invoice review page

- Route: `/invoices/[id]/review`. Since a web page can be reloaded or
  linked to directly (unlike a mobile in-memory navigation stack), the
  page always dispatches `getInvoiceDetails(invoiceId)` on mount to
  hydrate `state.invoice.selectedInvoice` from the URL id, rather than
  assuming a prior screen already populated it (which is all mobile's
  version does — it just reads `state.invoice.selectedInvoice`
  as-is).
- Normalized incoming invoice data against the *actual* ported
  contract (invoiceSlice.ts's `ExtractedData` /
  invoiceApi.ts's `PostInvoiceExtractedData`), not mobile's
  `RawInvoiceData` type, which has drifted from it: dropped a
  "Tax Type" text field (mobile displays one, but the ported
  submit contract has no field for it — it would never persist
  anywhere) and mapped "Item Descriptions" to the real
  `description` string field instead of a nonexistent
  `itemDescriptions` array. Every other field maps directly to a real
  submit field.
- Found and fixed dead code while porting the vendorId-resolution
  fallback chain: mobile's `submitToQuickBooks` falls back to
  `createdVendor?.vendorDbId || createdVendor?._id`, but
  `CreatedVendor` (vendorSlice.ts) has neither field — and both the
  "select existing vendor" and "create new vendor" paths on the
  vendor-resolution screen (C5) always dispatch `setSelectedVendor`
  with a real `_id` regardless, so that fallback was already
  unreachable on mobile. Dropped it here rather than porting dead
  code forward.
- Confirmation dialogs (reject, post-to-QuickBooks, vendor-not-
  registered) use `window.confirm` per the cross-cutting Alert.alert
  note above.
- After a successful post or reject, mobile navigates to "MainTabs" —
  its only real screen, since it has no deeper navigation. This port
  returns to `/invoices/pending` (the queue the user came from)
  instead, since that page now genuinely exists (C17) and is the more
  useful destination — judgment call, not a mobile behavior being
  dropped.
- "View Invoice" links to `/invoices/preview?url=...&mimeType=...`
  (C16), a shared preview route also used from the invoice detail
  page (C15) — mirrors mobile's InvoicePreviewScreen being reachable
  from multiple screens via navigation params.

### C5 — Vendor resolution page

- Route: `/invoices/[id]/vendor`. Same direct-URL-load reasoning as
  C4: dispatches `getInvoiceDetails(invoiceId)` on mount so
  `state.invoice.selectedInvoice` (which this screen reads for the
  extracted vendor name) is populated even on a fresh page load, not
  only when navigated to from the review page. Mobile's version never
  actually reads its own `route.params.invoiceId` either — it only
  reads `selectedInvoice` from Redux — so this is a web-required
  addition, not a behavior change.
- The ported `Vendor` type (quickBooksSlice.ts: `_id`, `qbVendorId`,
  `displayName`, `normalizedName`) has no `address`/`email`/`phone`
  fields, unlike mobile's screen-local `Vendor` type which assumed
  they existed. Vendor rows here show display name only — the real
  ported contract, not the mobile screen's unverified assumption.
- Suggested/All/Create tabs, radio-select + sticky "Use this vendor"
  confirm footer, and the create-vendor form (name, currency, optional
  GL account, optional tax code) all ported behaviorally as-is,
  rendered as native selects/buttons instead of mobile's custom
  dropdown sheets.

### C6 — QuickBooks connect page

- Mobile has no screen dedicated solely to this — the connect/status/
  switch/disconnect UI (and its `QBAccountsModal` bottom sheet) all
  live inside AccountingSoftwaresScreen.tsx, the same screen C9
  targets. Judgment call: split it here into a standalone `/quickbooks`
  page (this task, the full connections list + connect/switch/
  disconnect) that C9's Accounting Softwares page will link to for
  "manage connections", rather than re-implementing a bottom-sheet
  modal inline — a dedicated page is the more natural web pattern than
  a modal-as-primary-navigation, which is what mobile did only because
  it has no persistent page-based navigation.
- Per the task's own instruction, uses the simple `connectToQuickBooks()`
  helper (src/lib/quickbooks/connect.ts, a plain
  `window.location.href` redirect) instead of the mobile `connectQuickBooks`
  thunk + `WebBrowser.openAuthSessionAsync` + polling dance. That mobile
  complexity exists specifically to work around in-app-browser
  lifecycle quirks (the browser sheet not auto-dismissing, needing a
  poll-then-force-close workaround) — none of which apply to a full
  page navigation on web, so it's not ported forward.
  Re-checks connection status on window `focus` as the web equivalent
  of mobile's `AppState` foreground listener (e.g. after completing
  OAuth and returning to this tab).

### C7 — Team members page

- Route: `/team`. Ported behaviorally as-is: active-company card with
  role badge, invite card (owner/admin only) vs. permission notice,
  member list with role badges and role-gated remove buttons
  (owner removes anyone, admin removes non-admins), and an invite
  form (email + role picker) kept as a modal — a short, focused,
  in-context action, unlike the longer forms elsewhere in this port
  that became dedicated pages.
- Remove-member and invite-failure alerts use `window.confirm`/
  `window.alert` per the cross-cutting Alert.alert note.

### C8 — Invite-accept page

- Route: `/invite/accept?token=...` (matches TASKS.md's explicit path).
  Ported behaviorally as-is: no token -> /login; unauthenticated ->
  save the pending token then redirect to /login?fromInvite=true
  (consumed by LoginForm's post-login pending-invite-accept flow from
  C1); authenticated -> dispatch acceptQBInvite directly, showing
  checking/success/error states. This page is in AuthGate's public
  route list since it needs to be reachable regardless of auth state
  (its own logic handles the redirect-when-unauthenticated case,
  rather than AuthGate's blanket gate).

### C9 — Profile / Accounting Softwares page

- Route: `/accounting-software`. QuickBooks card shows live status from
  state.quickBooks and links to /quickbooks (C6) for the full connect/
  switch/disconnect UI, rather than re-embedding that flow's bottom-
  sheet inline here (same reasoning as C6's split). Tally and Zoho
  Books cards are disabled "Coming Soon", exact match to mobile.
- **Flagging a real discrepancy, but following the seeded decision
  anyway:** Scantrix_v2's AccountingSoftwaresScreen.tsx actually calls
  a real backend pair for Google Drive — `GET /google-drive/connect`
  (returns an authUrl) and `GET /google-drive/status` — not just a
  client-side mock. That contradicts this repo's pre-seeded
  ASSUMPTIONS.md and TASKS.md wording ("no backend endpoint exists for
  this — do NOT build one"), both written before this loop started.
  Per the Zero-Questions Rule and the explicit "not a decision the
  loop should second-guess" instruction, this pass still keeps Google
  Drive a client-side-only mockup (a `driveConnected` localStorage
  flag toggled by the card, matching mobile's own local cache key
  name, but with no network call at all) — deliberately not wiring the
  real endpoint even though it appears to exist, since going beyond
  the explicitly pre-scoped boundary for a third OAuth integration
  wasn't asked for. Flagging this clearly for a human: if Google Drive
  connect should be real, the backend contract is already known
  (`/google-drive/connect?redirectUri=`, `/google-drive/status`) and
  wiring it is a small, well-scoped follow-up — not attempted here.

### C10 — Delete Account entry point

- Route: `/profile` (created here; C19 extends this same file with the
  rest of ProfileOptionsScreen's hub content — profile summary card,
  Settings/Legal/Support sections, Logout — rather than this task
  building a throwaway page C19 later replaces). Per TASKS.md's
  explicit instruction and the Pre-Marked BLOCKED list: real
  confirmation dialog (`window.confirm`, matching mobile's
  Alert.alert text verbatim), but the delete action itself is a
  disabled "Coming Soon" stub — no backend endpoint exists. Flagged
  separately as a real compliance requirement needing scoped backend
  work, not a tonight decision.

### C11 — Subscription pages

- Routes: `/plans`, `/subscription` (status), `/subscription/paywall`
  — the last of these was subsequently renamed to `/paywall` during
  C12; see that entry. All three ported as pure UI mocks, exact
  numbers from the fixed pricing (Trial free/14 days/1 slot; Standard
  $15mo or $149yr/1 slot; Enterprise $30mo or $299yr/3 slots; all
  unlimited scans/team members) — no real billing calls anywhere.
  Tapping any plan/upgrade action shows "Preview only — full
  subscription flow coming soon." verbatim, matching the mobile
  mockup precedent exactly.
- SubscriptionStatusContent has no hooks or handlers of its own (only
  a Link), so it stays a Server Component — the one subscription page
  that doesn't need 'use client'.

### C12 — Global app shell

- Genuinely new information architecture, as already flagged before
  the loop started: MainTabNavigator is a single-screen stack despite
  its name, so mobile has no real persistent nav to port. Built a left
  sidebar (AppShell) instead of a top nav — more conventional for a
  desktop B2B app like this — linking every page from C1–C11: Dashboard,
  Invoices (forward reference to C14, not built yet at this point in
  the loop but the route is reserved), QuickBooks, Team, Accounting
  Software, Subscription, and an Account/Logout footer. Plans (C11) and
  the invoice review/vendor pages (C4/C5) stay reachable by one hop
  from their parent pages, matching how mobile drills into them too —
  they're not top-level nav items on mobile either.
- Implemented shell-wrapping as a runtime decision inside AuthGate
  (checks `isAuthenticated` + a `NO_SHELL_ROUTES` pathname list) rather
  than a Next.js route group. A route group would have required
  physically relocating every existing page under an `(app)/` folder,
  and — critically — `/invoices/[id]/review` and `/invoices/[id]/vendor`
  already exist as a *sibling* tree to where `/invoices` (C14) and
  `/invoices/[id]` (C15) need to live; Next's own route-groups docs
  warn that two different physical folders must never resolve
  overlapping URL paths, and mixing a grouped "invoices" folder with
  an ungrouped one for the same prefix was a real conflict risk, not
  just a style preference. Deciding shell visibility at runtime sidesteps
  that entirely and needed no file moves.
- Consequence of the above: invoice review/vendor pages **do** get the
  persistent shell now (unlike mobile's full-screen push), a
  simplification judgment call. `/paywall` (C11) and every auth screen
  (login/register/verify-otp/invite-accept) stay shell-free full-bleed
  screens, matching mobile's own modal-like/full-screen presentation
  for those.
- The QuickBooks company switcher deferred from C3 (see that entry)
  now lives here, in the sidebar — fetches connections on mount and
  switches the active one, exactly the piece of UI mobile only ever
  showed inside DashboardScreen's own header.
- "/" now redirects: unauthenticated → /login (already covered by the
  generic protected-route rule), authenticated → /dashboard (new
  special case added to AuthGate). The scaffold's original
  create-next-app placeholder content is gone from page.tsx — it was
  never reachable through AuthGate anyway once restoring/redirect
  logic runs, so replaced with a one-line placeholder rather than kept
  as dead template content.
- Logout is now available from two places (sidebar footer, and C19's
  full profile page) — factored into one shared `useLogout()` hook
  (src/store/useLogout.ts) so the dispatch+redirect logic isn't
  duplicated.
- **Rename, done as part of this task:** `/subscription/paywall` (as
  built in C11) moved to `/paywall` (top-level) specifically so it
  could stay shell-free without any folder-nesting ambiguity next to
  the grouped `/subscription` route.

### C13 — Verify-OTP page

- Route: `/register/verify-otp?email=...&inviteToken=...` (query params
  set by RegisterForm's goToVerifyOtp — see C1's ASSUMPTIONS entry on
  why no password is ever put in this URL). Ported behaviorally as-is:
  6 auto-advancing digit boxes, 60s resend countdown, verify dispatches
  verifyRegisterOtp then acceptQBInvite if an inviteToken is present,
  redirecting to /dashboard on success (verifyRegisterOtp's own
  thunk already saves tokens/user and marks isAuthenticated, so no
  separate login step is needed here — matches mobile exactly).

### C14 — Invoice list pages

- Route: `/invoices?type=auto|manual|failed` (query-param design, one
  page component instead of three routes — matches how mobile's own
  InvoiceListScreen is a single component keyed by a `type` param).
  Dispatches `getInvoices()` on mount for direct-URL-load robustness
  (same reasoning as C4/C5), rather than assuming Dashboard already
  populated the store.
- Extended src/lib/invoiceDisplay.ts (built in C3) with `accentHex`/
  `accentTextClass` per status instead of creating InvoiceListScreen's
  own separate THEME_CONFIG copy — one more consolidation of the
  per-screen theme drift mobile had. Minor rounding accepted: mobile's
  `tagBg`/`badgeBg` are two very slightly different tints of the same
  color per status; this port uses one shared badge tint for both the
  status tag and the confidence pill.
- Row click sets `selectedInvoice` then navigates to `/invoices/[id]`
  (C15, not built at this point in the loop — forward reference, same
  pattern used throughout this port when a later task's route is
  already known).

### C15 — Invoice detail page

- Route: `/invoices/[id]?type=auto|manual|failed`. Confirms the C12
  route-nesting decision was sound: this page.tsx sits directly in
  `src/app/invoices/[id]/` alongside the `review/` and `vendor/`
  child folders with zero conflict — ordinary Next.js nested routing,
  not the route-group scenario that was actually risky.
- New src/lib/invoiceDetailTheme.ts (hex values ported verbatim from
  InvoiceDetailsScreen's THEME_CONFIG) rather than extending
  invoiceDisplay.ts's simpler INVOICE_STATUS_THEME — this screen has
  materially more per-status surfaces (section header tint, divider
  color, timeline accent) that the shared theme doesn't carry, so a
  dedicated theme file was the more honest fit than stretching a
  smaller shared shape to cover it.
- Normalized field names against the real ExtractedData contract, same
  correction as C4: `bankingDetails` not `vendorBankDetails`,
  `description` (single string) not `itemDescriptions` (array), no
  `taxType` field (dropped — matches C4's reasoning exactly, since
  it's the same underlying data record).
- GL account name is resolved read-only here (fetches
  fetchQuickBooksAccounts, looks up by id) — no picker, matching
  mobile exactly; this page never edits anything.
- "View"/"View Original Invoice" link to `/invoices/preview?url=...`
  (C16, forward reference, same as C4).

### C16 — Invoice file preview viewer

- Route: `/invoices/preview?url=...&mimeType=...`, used from both C4
  (review) and C15 (detail). Ported directly from Scantrix_v2's own
  `InvoicePreviewScreen.web.tsx` — the mobile repo already ships a
  web-specific variant of this exact screen (iframe for PDF, `<img>`
  for image), so this is a straight port, not a fresh adaptation from
  the native `react-native-pdf` version.
- `/invoices/preview` (static) and `/invoices/[id]` (dynamic) coexist
  at the same route level with no conflict — Next.js resolves static
  segments before dynamic ones, standard App Router behavior, not
  something that needed a workaround.

### C17 — Pending invoices queue list page

- Route: `/invoices/pending` (matches the link already wired from C3's
  Dashboard and C4's post/reject-success redirect). Ported
  behaviorally as-is: title/invoice-number/amount summary, single
  most-important issue pill (status-history reason, falling back to
  missing-fields list), row click clears selected/created vendor then
  sets selectedInvoice and routes to `/invoices/[id]/review` (C4).
  dispatches getInvoices() on mount + a manual refresh button (web
  equivalent of mobile's pull-to-refresh via useFocusEffect, which has
  no direct web analog).

### C18 — Edit Profile page

- Route: `/profile/edit`. Real Firebase Auth (`updateProfile`) +
  Firestore (`setDoc` merge on `users/{uid}`) calls, matching mobile
  exactly. Photo picking is a real `<input type="file" accept="image/*">`
  (matching C3's upload-trigger precedent) rather than calling
  `pickProfileImage()` — that function is an intentional stub in
  authApi.ts whose own comment says exactly this: "Profile image
  selection on web should be implemented in the UI layer with a
  browser file input... this function is a placeholder until that UI
  is built." It's left in place, now genuinely superseded rather than
  dead-by-accident.
- **Real bug fix, not a judgment call:** `updateProfileIcon`
  (authApi.ts) had the same class of bug just fixed in C3's
  `scanInvoice` — an RN-only `{uri, name, type}` FormData shape, plus a
  manually-set `Content-Type: multipart/form-data` header with no
  boundary (browsers must generate that themselves). Fixed to accept a
  browser `File` directly and let the browser set its own
  Content-Type. Same root cause, same fix pattern, different call
  site — worth calling out again since it's a second instance of the
  identical inherited bug class, not a one-off.

### C19 — Profile/Account settings hub page

- Extends /profile (C10) in place, as planned there: profile summary
  card linking to /profile/edit (C18), Settings section (Connect
  Software -> /accounting-software, Team Members -> /team,
  Subscription -> /subscription), Legal section (Terms & Conditions,
  Privacy Policy), Support section (Contact Support), Account Actions
  (Logout via the shared useLogout() hook from C12, Delete Account
  from C10).
- Two real simplifications from mobile, both judgment calls: (1)
  "Contact Support" is a plain `mailto:` link instead of mobile's
  custom app-picker sheet (Gmail/Outlook/Default Mail deep links) —
  those deep links exist only to route around mobile OS mail-client
  ambiguity; a browser's own `mailto:` handling already solves that on
  desktop web, so the picker UI has no web equivalent worth building.
  (2) Terms & Privacy open the S3-hosted PDFs directly in a new browser
  tab instead of mobile's in-app WebView + Google-Docs-viewer wrapper
  — browsers render PDFs natively, so that wrapper has no purpose here
  either.

## Blocked / stubbed items — reason and exact next step

1. **Apple Sign-In (web)** — `src/components/auth/AppleSignInButton.tsx`,
   disabled "Coming Soon" button.
   - Reason: needs a Services ID + web redirect URIs in Apple
     Developer. Not present anywhere in the checked sources.
   - Next step for a human: create an Apple Services ID + configure
     web redirect URIs in the Apple Developer portal for this app,
     then wire Sign in with Apple JS in place of the disabled button.

2. **Google Sign-In (web) — origin allowlist, NOT the sign-in code
   itself.** Real Google Identity Services wiring is done
   (`src/components/auth/GoogleSignInButton.tsx`).
   - Reason: the OAuth client ID found in mobile source was
     provisioned for native ID-token verification, which doesn't
     enforce an origins allowlist; browser-based GIS sign-in does.
   - Next step for a human: in Google Cloud Console, on OAuth client
     `244169573027-ttt4i12jqi1coi0hhk90saslrra76t4a`, add this web
     app's origin(s) — `http://localhost:3000` for local dev and the
     real production domain — to "Authorized JavaScript origins."
     Nothing in the code needs to change for this.

3. **Google Drive connect** —
   `src/components/accounting/AccountingSoftwaresContent.tsx`,
   client-side-only `localStorage` toggle, no network call.
   - Reason: pre-scoped as a mockup before this loop started, even
     though the mobile source shows a real backend pair for it
     (`GET /google-drive/connect?redirectUri=`, `GET /google-drive/status`).
   - Next step for a human: confirm whether real Google Drive connect
     is wanted for the web app; if so, wire those two endpoints the
     same way `/quickbooks` (C6) wires QuickBooks connect — the
     contract is already known, this is a small follow-up.

4. **Delete Account** — `src/components/profile/ProfileContent.tsx`,
   real confirmation dialog, "Coming Soon" alert instead of an actual
   delete call.
   - Reason: no backend endpoint exists; flagged in an earlier App
     Store audit as a real compliance requirement (GDPR/App Store
     Guideline 5.1.1(v) — account deletion must be available)
     needing scoped backend work, not a decision for this pass.
   - Next step for a human: scope and build a real
     `DELETE /users/:id`-style backend endpoint (with whatever data-
     retention/anonymization policy legal requires), then replace the
     `window.alert` in `handleDeleteAccount` with a real dispatch.

5. **Subscription / billing** — `/plans`, `/subscription`, `/paywall`,
   pure UI mockups, fixed pricing, no payment processor.
   - Reason: explicitly out of scope (Phase 2 in the original
     subscription design doc, per the pre-seeded assumption); matches
     the mobile app's own mockup precedent exactly.
   - Next step for a human: integrate a real payment processor
     (Stripe or similar) and QuickBooks-slot enforcement server-side
     before any of these three pages can move past "Preview only."

6. **Vercel deployment** — never invoked by this loop.
   - Reason: `LOOP.md` explicitly forbids it; deployment is a human
     decision after review.
   - Next step for a human: review the branch, merge to `main` (or
     open a PR) when satisfied, then deploy via Vercel (or whatever
     the team's actual deploy process is) manually.

## What a human should do first, tomorrow morning

1. Read this file and `README.md`.
2. `npm install && cp .env.local.example .env.local` (already has real
   values filled in during this loop, at `.env.local` — gitignored,
   still present on disk if this branch's working tree is used
   directly; otherwise re-populate from this report's A7 notes and
   `src/lib/quickbooks/connect.ts` / `src/lib/firebase/config.ts`).
3. `npm run dev`, click through the golden paths manually: register →
   verify OTP → dashboard → upload an invoice → review → post to
   QuickBooks; connect QuickBooks for real; invite a team member.
   This loop verified every page builds and server-renders without
   crashing, but did **not** click through real user flows in a
   browser or against the live backend — that's explicitly a human
   task per `LOOP.md`.
4. Add this web app's origin to the Google OAuth client's allowed
   JavaScript origins (item 2 above) before testing Google Sign-In.
5. Decide on the five other BLOCKED/stubbed items above, in whatever
   priority order matters to the business — none of them block normal
   use of the app today.
