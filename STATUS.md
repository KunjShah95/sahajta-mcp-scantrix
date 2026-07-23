# STATUS.md — mobile → web feature parity table

Written by Phase B (B1) self-audit. One row per screen found under
~/Scantrix_v2's `src/screens/**/*.tsx` (branch frontend-ui-v2, 19
files total). "Status in this repo" reflects state at the moment this
table was written (Phase B, before Phase C); it is not updated
retroactively as Phase C proceeds — see PROGRESS.md for the live
build log instead.

| # | Screen | Mobile file path | What it does | Status in this repo |
|---|--------|-------------------|---------------|----------------------|
| 1 | SplashScreen | src/screens/auth/SplashScreen.tsx | Native launch screen: checks AsyncStorage for a stored user, waits ~1.8s, then routes to MainTabs or Login. | MISSING — but not a gap task of its own. A web app has no native splash; this job is subsumed by C2's auth-gate loading state (check auth, then redirect). No new Phase C task added. |
| 2 | LoginScreen | src/screens/auth/LoginScreen.tsx | Email/password login form, Google Sign-In, Apple Sign-In (iOS only), session-expired/invite banners, link to Create Account. | MISSING — covered by existing task C1. |
| 3 | CreateAccountScreen | src/screens/auth/CreateAccountScreen.tsx | Registration form (name, email, phone w/ country code picker, password), Google/Apple sign-up, dispatches registerUser then routes to OTP verification. | MISSING — covered by existing task C1. |
| 4 | VerifyOTPScreen | src/screens/auth/VerifyOTPScreen.tsx | 6-digit OTP entry (per-digit inputs) with resend countdown, verifies registration via verifyRegisterOtp, accepts a pending QB invite if present. | MISSING — not explicitly named in Phase C. New gap task added: **C13**. |
| 5 | InviteAcceptScreen | src/screens/auth/InviteAcceptScreen.tsx | Reads a `token` route param, redirects to Login if unauthenticated (stashing the token first), otherwise calls acceptQBInvite and shows checking/success/error states. | MISSING — covered by existing task C8. |
| 6 | DashboardScreen | src/screens/dashboard/DashboardScreen.tsx | Home screen: greeting, summary cards (pending/auto/manual/failed counts, each tappable to a filtered invoice list), upload trigger, QuickBooks connect banner if not connected. | MISSING — covered by existing task C3. |
| 7 | PendingInvoicesScreen | src/screens/pending/PendingInvoicesScreen.tsx | Scrollable queue of invoices awaiting review, each row showing vendor/amount/confidence/primary issue, tap → InvoiceReviewScreen. | MISSING — not explicitly named in Phase C (C4 only covers the single-invoice review screen, not the queue list that feeds it). New gap task added: **C17**. |
| 8 | InvoiceReviewScreen | src/screens/pending/InvoiceReviewScreen.tsx | Edit extracted invoice fields (vendor, amounts, dates, line items, GL account, currency), resolve vendor, post to QuickBooks or reject. | MISSING — covered by existing task C4. |
| 9 | VendorResolutionScreen | src/screens/VendorResolutionScreen.tsx | Suggested/all/create-new vendor tabs, resolves an extracted vendor name to a real QuickBooks vendor or creates one. | MISSING — covered by existing task C5. |
| 10 | InvoiceListScreen | src/screens/invoice/InvoiceListScreen.tsx | Full list of invoices filtered by posted status (auto / manual / failed), themed per status, tap → InvoiceDetailsScreen. | MISSING — not explicitly named in Phase C (distinct from both the Dashboard's "recent invoices" preview and the pending-review queue — this is the post-decision, already-posted/failed list). New gap task added: **C14**. |
| 11 | InvoiceDetailsScreen | src/screens/invoice/InvoiceDetailsScreen.tsx | Full detail view of one already-processed invoice: extracted fields, GL account, status history/timeline, themed per status (auto/manual/failed). | MISSING — not explicitly named in Phase C. New gap task added: **C15**. |
| 12 | InvoicePreviewScreen (+ .web.tsx variant) | src/screens/invoice/InvoicePreviewScreen.tsx / .web.tsx | Full-screen preview of the source invoice file — PDF or image. The mobile source already ships a `.web.tsx` variant (`<iframe>` for PDF, `<img>` for image) — a direct, ready-made reference for this exact port. | MISSING — not explicitly named in Phase C (used by both Invoice Review and Invoice Details). New gap task added: **C16**. |
| 13 | AccountingSoftwaresScreen | src/screens/profile/AccountingSoftwaresScreen.tsx | QuickBooks connect/status card, Tally + Zoho Books "Coming Soon" cards, Google Drive connect-only mockup card. | MISSING — covered by existing task C9. |
| 14 | EditProfileScreen | src/screens/profile/EditProfileScreen.tsx | Edit display name and profile photo (Firebase Auth + Firestore `updateProfile`/`setDoc`, `pickProfileImage` stub for image picking). | MISSING — not explicitly named in Phase C. New gap task added: **C18**. |
| 15 | ProfileOptionsScreen | src/screens/profile/ProfileOptionsScreen.tsx | The actual account/settings hub: profile summary card, links to Edit Profile / Connect Software / Team Members / Subscription, support email sheet, Terms & Privacy PDF viewer, logout, and the Delete Account confirmation (currently a "Coming Soon" alert stub in mobile). | MISSING — C9 only covers the Accounting-Softwares sub-page's content, and C10 covers the Delete Account entry point but assumes a hosting page exists. New gap task added for the hub page itself: **C19** (C10's Delete Account UI lives inside it). |
| 16 | TeamMembersScreen | src/screens/profile/TeamMembersScreen.tsx | QB connection picker, invite-by-email with role picker, member list with role badges, remove-with-confirm. | MISSING — covered by existing task C7. |
| 17 | PlansScreen | src/screens/subscription/PlansScreen.tsx | Static mock plan cards (Trial/Standard/Enterprise) with monthly/yearly toggle; tapping any plan/upgrade shows a "Preview only" alert. | MISSING — covered by existing task C11. |
| 18 | SubscriptionStatusScreen | src/screens/subscription/SubscriptionStatusScreen.tsx | Static mock of the current plan/billing date/slot usage. | MISSING — covered by existing task C11. |
| 19 | SubscriptionPaywallScreen | src/screens/subscription/SubscriptionPaywallScreen.tsx | Static mock 402-style block screen ("Subscription Required"), upgrade button shows "Preview only" alert. | MISSING — covered by existing task C11. |

## Gap tasks appended to Phase C (see TASKS.md)

- **C13** — VerifyOTP page (row 4)
- **C14** — Invoice list pages, auto/manual/failed (row 10)
- **C15** — Invoice detail page (row 11)
- **C16** — Invoice file preview viewer (row 12) — mobile already has a
  ready-made `.web.tsx` reference for this one
- **C17** — Pending invoices queue list page (row 7)
- **C18** — Edit Profile page (row 14)
- **C19** — Profile/Account settings hub page (row 15), hosting C10's
  Delete Account entry point

No new task was added for SplashScreen (row 1) — its job is fully
subsumed by C2's auth-gate loading state on the web.
