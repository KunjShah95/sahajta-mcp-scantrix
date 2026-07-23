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

## A7 — .env.local population, and reversing the Google Sign-In pre-mark

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

## Cross-cutting — React Native `Alert.alert` → browser dialogs

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

## C3 — Dashboard page

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

## C4 — Invoice review page

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

## C5 — Vendor resolution page

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

## C6 — QuickBooks connect page

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

## C7 — Team members page

- Route: `/team`. Ported behaviorally as-is: active-company card with
  role badge, invite card (owner/admin only) vs. permission notice,
  member list with role badges and role-gated remove buttons
  (owner removes anyone, admin removes non-admins), and an invite
  form (email + role picker) kept as a modal — a short, focused,
  in-context action, unlike the longer forms elsewhere in this port
  that became dedicated pages.
- Remove-member and invite-failure alerts use `window.confirm`/
  `window.alert` per the cross-cutting Alert.alert note.

## C8 — Invite-accept page

- Route: `/invite/accept?token=...` (matches TASKS.md's explicit path).
  Ported behaviorally as-is: no token -> /login; unauthenticated ->
  save the pending token then redirect to /login?fromInvite=true
  (consumed by LoginForm's post-login pending-invite-accept flow from
  C1); authenticated -> dispatch acceptQBInvite directly, showing
  checking/success/error states. This page is in AuthGate's public
  route list since it needs to be reachable regardless of auth state
  (its own logic handles the redirect-when-unauthenticated case,
  rather than AuthGate's blanket gate).

## C9 — Profile / Accounting Softwares page

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

## C10 — Delete Account entry point

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

## C11 — Subscription pages

- Routes: `/plans`, `/subscription` (status), `/subscription/paywall`.
  All three ported as pure UI mocks, exact numbers from the fixed
  pricing (Trial free/14 days/1 slot; Standard $15mo or $149yr/1 slot;
  Enterprise $30mo or $299yr/3 slots; all unlimited scans/team
  members) — no real billing calls anywhere. Tapping any plan/upgrade
  action shows "Preview only — full subscription flow coming soon."
  verbatim, matching the mobile mockup precedent exactly.
- SubscriptionStatusContent has no hooks or handlers of its own (only
  a Link), so it stays a Server Component — the one subscription page
  that doesn't need 'use client'.

## C12 — Global app shell

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
