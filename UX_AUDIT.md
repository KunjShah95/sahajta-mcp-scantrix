# UX_AUDIT.md — live browser audit (read-only, no fixes applied)

Written by a live headless-Chrome pass (puppeteer-core, real installed Chrome,
same technique used earlier in this session for the landing-page audit).
Unlike `DESIGN_STATUS.md` (which was explicitly a code-only read — no browser
was available that session), every finding below was captured from the app
actually running against the real backend (`https://api.savetrix.com`), in a
real authenticated session, with real invoice/vendor/organization data.

**Test account:** `nikhil@savetrix.com` (provided by the user for this audit).
Org: "Savetrix Accounting Services LLP", one QuickBooks connection, 10 real
invoices (6 pending, 3 manually posted, 1 failed, 0 auto-posted).

**Method:** `next dev` on `localhost:3001` (already running from a prior
session), Chrome launched headless via puppeteer-core with an explicit
`executablePath`, full-page + viewport screenshots at 1440×900 (desktop) and
390×844 (mobile) for every reachable route, plus targeted DOM/CSS inspection
(`getBoundingClientRect`, computed styles, live HTTP response codes) for the
three anchor issues. Screenshots are stored outside the repo in the session
scratchpad, not committed.

**Coverage limitation:** Pre-auth routes that need a fresh token I don't have
(`/register/verify-otp` mid-flow, `/invite/accept` with a live invite token)
and `/invoices/preview` (needs a real signed file URL as a query param)
were **not** re-verified live this pass — those rely on `DESIGN_STATUS.md`'s
prior code read. Every other route was visited live and logged in. This
account has exactly one QuickBooks connection, so the org-switcher's
*multi*-connection list rendering (2+ rows) was not visually observed —
only the single-connection case.

---

## Anchor issue 1 — sticky footer overlaps page content

**Verdict: confirmed, and worse than the original description — two distinct,
compounding causes, reproducible on every invoice-review/vendor-resolution
page, not an edge case.**

### What's actually happening

On `/invoices/[id]/review` (`InvoiceReviewContent.tsx`), at the **default
scroll position** (no user scrolling yet), the fixed action bar
(`fixed bottom-[var(--space-md)] left-1/2 -translate-x-1/2 max-w-2xl`,
[InvoiceReviewContent.tsx:637](src/components/invoices/InvoiceReviewContent.tsx#L637))
already overlaps real, interactive form content — in the captured session,
the **GL Code / Category** field and its `GL account is required` validation
error. The "Post Manually" button is disabled at that point
(`vendorResolutionRequired && !vendorIsResolved` →
`disabled:opacity-45`, [line 650](src/components/invoices/InvoiceReviewContent.tsx#L650)),
so at 45% opacity the covered field's red text is clearly legible through it
— this is the literal "Amount field legible through the button" symptom,
just landing on whichever field happens to sit in that viewport band for a
given invoice's content height (GL Account here; Amount for a shorter
error-message state).

**Root cause A — `pb-32` does not do what it looks like it does.** The task
brief's hypothesis ("missing bottom padding on the scrollable area vs. the
footer height") is only half right. `pb-32` (128px) on the outer
`min-h-screen` wrapper *is* generous — more than enough clearance once the
user has scrolled all the way to the bottom (confirmed: the final "Item
Descriptions" field is fully clear of the footer at max scroll). The actual
bug is that the footer is `position: fixed`, so it permanently occupies the
same ~64–80px band of the *viewport* (16px bottom offset + 48px button
height) **at every scroll position, not just the end**. Padding at the
bottom of scrollable content can never fix an overlap that happens at the
*top* of the scroll range — which is exactly where this reproduces, on
first paint, before the user has scrolled at all.

**Root cause B — the footer is centered against the wrong box.** The footer
uses `left-1/2 -translate-x-1/2 w-full max-w-2xl`, which centers it against
the **full browser viewport**, not the content area to the right of the
persistent sidebar. On desktop (1440px, sidebar 256px) this silently shifts
the button bar ~110px left of the actual content column above it — visible
in the screenshot as the footer's left edge sitting noticeably left of the
form fields' left edge. On a 390px mobile viewport this stops being subtle:
the sidebar (even collapsed to its 64px icon rail) eats a large fraction of
the 390px width, and the fixed footer — still computed against the full
390px — renders **partly underneath the sidebar rail**, clipping the
"Reject" button (only "…ject" is visible) and colliding with the sidebar's
own fixed-position user-avatar circle, which visually stamps on top of the
Reject button.

### `/invoices/[id]/vendor` shares the family bug, different manifestation

`VendorResolutionContent.tsx`'s footer
([line 363](src/components/invoices/VendorResolutionContent.tsx#L363)) uses
`fixed bottom-0 left-0 right-0` — full viewport width, not inset for the
sidebar at all. Live repro (select any vendor from the "All vendors" tab):
the "Selected vendor / \<name\>" footer renders **directly on top of the
sidebar's own bottom section**, visually colliding with (and obscuring) the
persistent "nikhil" / "Logout" block. Same root cause family — a
content-column footer that doesn't know a persistent sidebar exists — just
manifesting as overlapping the *shell* instead of overlapping the *page*.

- **Route:** `/invoices/[id]/review` — **BLOCKER**. Reproduces on first
  paint, before any scrolling, on every invoice that needs vendor
  resolution (majority of this account's queue). A disabled button showing
  the error text of the field it's covering is actively confusing.
- **Route:** `/invoices/[id]/vendor` — **BLOCKER** on mobile widths (footer
  visibly overlaps sidebar chrome); **COSMETIC-leaning** on desktop (footer
  renders over the sidebar's background but doesn't obscure anything
  load-bearing at 1440px since the sidebar's text sits above the footer's
  vertical range in that state — still worth fixing, same bug class).
- **No other route in the app uses this `fixed`-footer-over-scrollable-form
  pattern** — `/team`, `/profile`, `/quickbooks` etc. all use normal
  in-flow buttons, so this is isolated to the two invoice-processing
  screens.

**Recommended direction (not applied):** stop using `position: fixed` for
either footer. Make the page's outer layout a column flex
(`main` already exists as a flex sibling in `AppShell`) with the invoice
content in an `overflow-y-auto` region and the action bar as a normal
in-flow (or `sticky bottom-0` *within that same column*) element — that
way it naturally sits within the content column's actual width and only
ever appears after the true end of scrollable content, never over it.

---

## Anchor issue 2 — sidebar org name appears twice

**Verdict: confirmed and root-caused. Not a stuck loading/skeleton state —
it's a dropdown that never closes.**

`AppShell.tsx` keeps `switcherOpen` as local `useState`
([line 54](src/components/shell/AppShell.tsx#L54)), and `AppShell` **does
not remount between route navigations** — it's the persistent layout
wrapping every authenticated page. There is:

- no click-outside handler to close the dropdown,
- no `useEffect` keyed on `pathname` to reset `switcherOpen` on navigation,
- and no visual change to the toggle's chevron icon when open (it doesn't
  rotate/flip), so the pill still *looks* closed even when it isn't.

**Live repro:** click the org-switcher chevron once (a completely normal,
invited interaction — that's what the chevron is for) to open it, then
click any sidebar nav link (client-side `Link` navigation, no full reload).
The dropdown **stays open** on the destination page. Screenshot evidence
(`switcher-after-nav-to-invoices.png`): after opening the switcher on
`/dashboard` and navigating to `/invoices`, the sidebar shows "Savetrix
Accounting Servi…" in the pill *and* "Savetrix Accounting Servic…" again
directly beneath it in a plain bordered box — exactly the reported symptom.
With only one QuickBooks connection on this account, the "dropdown" has
exactly one row, styled `font-bold text-primary` (it matches the active
connection) with no chevron of its own and no separating header — visually
indistinguishable from a second, static copy of the org name rather than an
open menu.

This will reproduce for **any** user, on **any** page, the moment they ever
click that chevron and then click a nav link — not a rare edge case.

- **Route:** sidebar (all authenticated routes) — **BLOCKER**. Trivial to
  trigger, looks like a rendering bug (duplicated text) to a first-time
  viewer, and persists indefinitely until the user happens to click the
  chevron again.

**Recommended direction (not applied):** close the dropdown on route change
(`useEffect(() => setSwitcherOpen(false), [pathname])`) and/or add a
click-outside handler; also flip the chevron icon (`ChevronUp`/rotate) when
open so an accidentally-reproduced open state is at least legible as a menu.

---

## Anchor issue 3 — QuickBooks icon in full color vs. monochrome nav icons

**Verdict: deliberate and consistently applied — not a bug.** Recommend
leaving as-is, but see the adjacent IA note below.

`BrandIcon.tsx` renders licensed third-party marks (`simple-icons`:
QuickBooks, Google Drive, Zoho) in each brand's real hex color, by explicit
design (documented in the component's own comment and `DESIGN_ASSUMPTIONS.md`
D1.1) — the same convention as any "Connect to X" button showing X's real
logo. Live-checked every place a brand mark appears:

- **`/accounting-software`** (screenshot: `route_accounting-software-viewport.png`):
  QuickBooks (green), Google Drive (real multi-color triangle), Zoho Books
  (real red) all render in true brand color side by side. Tally — the one
  integration with **no legitimately licensed mark available**
  (documented, not an oversight) — correctly falls back to a generic
  monochrome `Calculator` icon, visually distinct from the licensed marks.
- **Landing page / marketing mockups** (`LandingPage.tsx`, `mockups.tsx`):
  same three brand marks, same real colors, consistently.
- **Sidebar** (`AppShell.tsx` `NAV_ITEMS`): the *only* nav item representing
  a specific third-party brand is "QuickBooks" (→ `/quickbooks`), and it's
  the only one using `BrandIcon`. Every other nav item (Dashboard, Invoices,
  Team, Accounting Software, Subscription) represents a generic in-app
  section, not a brand, and correctly uses monochrome `lucide-react` icons.

I found **no instance** of the same brand rendering monochrome in one place
and in color in another (the specific inconsistency the brief asked me to
check for) — Google Drive and Zoho never appear monochrome anywhere in the
app. The pattern is: *real third-party brand → real color, everywhere;
generic/functional destination → monochrome lucide, everywhere*. That's a
legitimate, common SaaS convention, applied without exception.

**Separate, lower-severity observation (IA, not color):** the sidebar has
*two* different paths that both ultimately manage QuickBooks — a dedicated
"QuickBooks" item (→ `/quickbooks`, connection management) and "Accounting
Software" (→ `/accounting-software`, a hub that *also* lists QuickBooks
alongside Drive/Zoho/Tally). A first-time user has no way to know which one
to use to, say, disconnect QuickBooks. **COSMETIC/IA**, not a rendering
bug — flagging as a decision point, not fixing.

---

## Additional confirmed findings (broader sweep)

### Invoice Details page shows the wrong status badge — BLOCKER

`/invoices/[id]` (`InvoiceDetailContent.tsx`) derives its status badge/theme
(`Auto-Posted` / `Manually Posted` / `Failed`, with matching color theme)
**entirely from the `?type=` URL query parameter**, defaulting to `"auto"`
when absent
([InvoiceDetailContent.tsx:70-72](src/components/invoices/InvoiceDetailContent.tsx#L70-L72)) —
it never reads the invoice's own `statusHistory`. Live repro: navigating
directly to `/invoices/6a6734e933d5fec0aa284416` (no query string) shows a
green **"Auto-Posted · 65% confidence"** badge for an invoice whose own
`statusHistory` says `Pending — vendor not found, please create`
(screenshot: `route_invoices_id.png`). Any link, bookmark, or back/forward
navigation that reaches this page without carrying the exact `type` param
the invoice actually belongs to will misrepresent a pending or failed
invoice as successfully auto-posted. This isn't cosmetic — it's incorrect
financial-status information.

### `/invoices` has no way to switch categories once you're on it — BLOCKER

Clicking "Invoices" in the sidebar always lands on `/invoices` with no
query string, which `InvoiceListContent.tsx` defaults to `type=auto`
([line 48](src/components/invoices/InvoiceListContent.tsx#L48)). For this
account that's **always empty** ("No invoices found" — 0 auto-posted vs. 3
manual, 1 failed that do exist). There is no tab bar, segmented control, or
any other in-page affordance to switch to Manually Posted or Failed —
**the only working entry points to those two lists are the three stat
cards on the Dashboard**, each hardcoded to a specific `?type=`
(`DashboardContent.tsx:228-235`). A user who clicks the primary "Invoices"
nav item — the obvious, expected way to browse invoices — reaches a page
that structurally cannot show most of their invoices, with no visible way
out except going back to Dashboard. Confirmed live for both `?type=manual`
(screenshot: `route_invoices_type-manual.png`, renders correctly *when
reached directly*) and `?type=failed`.

### No responsive/mobile sidebar behavior — BLOCKER on narrow viewports

Tested at 390×844 (iPhone-class viewport): the sidebar has no hamburger/
off-canvas behavior at all — it just keeps occupying its fixed pixel width
(64px collapsed / 256px expanded) regardless of viewport size, squeezing
the content column into whatever's left. Combined with Anchor Issue 1's
footer-centering bug, this is what causes the Reject button clipping on
mobile. Even setting aside that specific collision, permanently reserving
up to 65% of a 390px screen for the sidebar is itself worth a second look
for anyone expected to use this on a phone.

### `/plans` — Trial plan card is missing its call-to-action button — COSMETIC

Standard and Enterprise cards each end in a button ("Choose Plan" /
"Current Plan"); the Trial card ([screenshot: `route_plans.png`]) has no
button at all, breaking the visual rhythm of an otherwise identical
three-card grid and leaving no explicit way to select/preview the Trial
tier from this screen.

### Dashboard: inconsistent handling of one failed fetch — worth a look, lower confidence

One capture during this session showed the Dashboard's "Recent" list
correctly rendering an error+retry state ("Couldn't load this / Couldn't
load recent invoices"), while the three summary stat cards for the *same*
underlying invoices fetch silently showed `0` for all three counts instead
of any error indicator — i.e., one component visibly reports the failure
and two silently show incorrect zeros. I could not rule out this being a
transient backend rate-limit artifact from this session's rapid repeated
automated logins rather than a deterministic bug, so flagging with lower
confidence rather than as a firm finding — worth a human re-check under
normal usage.

### Default avatar placeholder graphic doesn't read as a profile photo — COSMETIC, lower confidence

On `/profile` and `/profile/edit`, this account's placeholder avatar (no
photo uploaded) renders as a solid teal circle containing what reads as an
"export/upload" arrow-out-of-box glyph, not a person silhouette or the
initials the app uses elsewhere (the sidebar's own collapsed-state avatar
correctly shows the initial "N"). Likely a backend-provided default image
URL (`hasPhoto` evaluated true, so the `<img>` branch rendered, not the
initials fallback) rather than a frontend bug — flagging for whoever owns
that default-avatar asset, not the frontend code.

### Positive confirmation: QuickBooks error surfacing works as intended

This test account's QuickBooks tax-codes endpoint reliably returns HTTP 500
(`/api/quickbooks/taxcodes`, confirmed on every load). The review page
correctly surfaces this via the plain-language error path added in the most
recent commit ("Couldn't load tax codes — The QuickBooks connection needs
to be reconnected," with an expandable "Show technical details") rather
than failing silently or crashing. Calling this out explicitly since it's
new, live, and working — not a regression to chase.

---

## Routes not flagged — checked live, no issues found

`/dashboard`, `/invoices/pending`, `/quickbooks`, `/team`, `/profile`,
`/profile/edit`, `/subscription`, `/accounting-software` all rendered
cleanly with real data: correct empty/loading/error states where
applicable, consistent spacing and alignment, no overlap or clipping
observed at 1440×900. `/paywall` (full-screen, no sidebar) also clean.

---

## Summary table

| # | Route | Finding | Severity |
|---|---|---|---|
| 1 | `/invoices/[id]/review` | Fixed footer overlaps in-flow content at initial scroll; disabled button translucency makes covered field text legible | BLOCKER |
| 1b | `/invoices/[id]/vendor` | Same footer-vs-sidebar-width bug family; collides with sidebar chrome | BLOCKER (mobile) / COSMETIC (desktop) |
| 2 | Sidebar (all routes) | Org-switcher dropdown never closes on navigation — persists as a visual duplicate | BLOCKER |
| 3 | Sidebar / `/accounting-software` | QuickBooks color icon — confirmed deliberate, consistent convention | Not a bug (recommend keep) |
| 3b | Sidebar | Redundant "QuickBooks" + "Accounting Software" nav entries | COSMETIC (IA) |
| 4 | `/invoices/[id]` | Status badge driven by URL param, not real invoice status — can show wrong status | BLOCKER |
| 5 | `/invoices` | No in-page way to switch Auto/Manual/Failed; sidebar nav always defaults to (often empty) Auto | BLOCKER |
| 6 | All routes, mobile widths | No responsive sidebar behavior; fixed width eats up to 65% of a phone screen | BLOCKER (mobile) |
| 7 | `/plans` | Trial card missing CTA button | COSMETIC |
| 8 | `/dashboard` | Stat cards silently show 0 vs. Recent list's error state, for the same failed fetch | Unconfirmed / low confidence |
| 9 | `/profile`, `/profile/edit` | Default avatar placeholder graphic doesn't read as a profile photo | COSMETIC / low confidence |
