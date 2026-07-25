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

## D0.3 — Research tooling available this session

- **ui-ux-pro-max skill: FOUND.** Located at
  `/Users/pranamyajain_/.agents/skills/ui-ux-pro-max/` (not under this
  repo's `.claude/skills/`, and `CLAUDE_PLUGIN_ROOT` is unset in this
  shell). `scripts/search.py` confirmed runnable directly via its
  absolute path with `python3` (sanity-checked with a throwaway `ux`
  domain query). Every research invocation this loop makes uses the
  literal absolute path
  `/Users/pranamyajain_/.agents/skills/ui-ux-pro-max/scripts/search.py`
  in place of `${CLAUDE_PLUGIN_ROOT}/.claude/skills/ui-ux-pro-max/...`
  since that env var isn't populated here — same script, same
  database, just invoked without the unset variable.
- **Web search: AVAILABLE** (WebSearch tool). Used as documented for
  anything outside the skill's local database (icon library licensing,
  brand-mark sourcing, current sidebar-collapse conventions).
- **WebFetch: AVAILABLE**, for reading specific pages WebSearch
  surfaces (e.g. an icon library's license page).
- **Browser/screenshot MCP tool: NOT AVAILABLE.** Checked the full
  deferred-tool list for this session (playwright/puppeteer/chrome-
  devtools/screenshot-style tools) — nothing found. The only related
  tool present, `DesignSync`, reads/writes claude.ai/design *projects*,
  not a locally-running dev server, so it cannot render or screenshot
  this app. Per DESIGN_LOOP.md's instruction for this exact case: this
  is noted here and will be repeated as an explicit line in
  DESIGN_FINAL_REPORT.md — **visual self-review of the running app was
  not possible tonight; a human's first task tomorrow is to run `npm
  run dev` and eyeball every route.** D3.1's self-audit and every
  Phase 4 fix are therefore judged by reading rendered JSX/CSS
  (component structure, Tailwind classes, computed spacing/color paths)
  against the researched design-system rules, not by looking at
  pixels.

## D0.5 — Design-system research (persisted to design-system/scantrix-web/MASTER.md)

Ran three queries: `--design-system --persist` for "professional B2B
SaaS invoice expense management tool for accountants and small
business owners, dashboard-heavy, trust-and-accuracy-oriented"
(persisted), a `--density 8 --motion 4 --variance 3` re-run to check
for a denser dashboard-specific match, and targeted `--domain product`
/ `--domain typography` queries for an admin/dashboard-app fit
specifically (the tool's own database leans toward marketing-landing-
page patterns, confirmed by both design-system runs returning a
"Landing Page Pattern" section neither applies to this app — Scantrix
Web has no marketing site, every route sits behind auth).

**Per DESIGN_LOOP.md, every COLORS section from all three runs is
discarded** — locked palette stands, D0.2 snapshot is the only color
reference for the rest of this loop.

**Style match:** "Trust & Authority" (`healthcare/medical, financial
services, enterprise software`) — validates the product-type fit
independent of its color suggestion. Its non-color anti-patterns
(playful design, hidden credentials) and its forbidden-pattern list
(emoji-as-icons, missing cursor-pointer, invisible focus states,
instant 0ms state changes) become the working checklist for Phase 1–2.

**Typography — researched, decision made:** the typography domain
query for "professional corporate finance dashboard readable"
returned three finance-appropriate pairings (Corporate Trust:
Lexend+Source Sans 3; Financial Trust: IBM Plex Sans; Modern
Professional: Poppins+Open Sans, the same pairing the design-system
run defaulted to). **Decision: keep Geist Sans/Geist Mono** (already
wired via `next/font` in `src/app/layout.tsx`, zero added network
request, zero FOUT risk) rather than swap to any researched pairing.
Reasoning: Geist is itself a modern, professional, high-legibility
grotesque already used across serious fintech/SaaS products (it's
Vercel's own product typeface) — it satisfies every "mood" keyword the
research returned (modern, professional, clean, corporate) without
introducing a third-party font-loading dependency for a problem
(illegible or unprofessional type) that doesn't actually exist here.
The real, named typography problem for this loop (D2.1) is
*inconsistent use of the existing type scale* — hardcoded font sizes
on some ported screens instead of the `--text-*` tokens — not the
wrong typeface family. Swapping families would also touch every page
cosmetically for no problem-statement reason, working against "the
smallest complete change that solves the stated problem."

**Spacing/radius/shadow — adopted:** MASTER.md's spacing scale
(`--space-xs` 4px … ) matches this repo's existing `--space-*` tokens
exactly through `--space-xl` (32px); MASTER.md additionally proposes
`--space-2xl` (48px) and `--space-3xl` (64px) for section-level
margins/hero padding this app doesn't have (no marketing hero
sections) — not adopted, no real gap found for them. MASTER.md's
component-spec radii (button 8px, card 12px, modal 16px) match this
repo's `--radius-sm`/`--radius-md`/`--radius-lg` exactly — existing
radius tokens confirmed correct, no change needed. **Real gap found
and adopted:** this repo's `globals.css` has no elevation/shadow scale
at all (every card currently either has no shadow or an ad-hoc
Tailwind `shadow-sm`/`shadow-md` utility with browser-default values,
not a themed token) — MASTER.md's 4-step shadow scale
(`--shadow-sm/md/lg/xl`, values above) is adopted verbatim as new
tokens in D2.1, since Tailwind's default shadow palette is exactly the
kind of one-off-value drift D2.1 is scoped to fix.

**Icons — confirmed, detailed in D1.1:** MASTER.md's forbidden-pattern
list and pre-delivery checklist both explicitly call out "emoji as
icons" as a checked anti-pattern and recommend SVG icon sets
(Heroicons, Lucide, Simple Icons for brand marks) — corroborates the
D1.1 task statement and will be the starting point for that task's own
deeper icon-domain research.

## D1.1 — Icon and brand-logo system

**Research:** `--domain icons` query for "finance SaaS professional
dashboard navigation action status" returned Phosphor Icons as the
local database's top match. Corroborated with a live web search
("lucide-react vs phosphor-icons React 19 tree shaking license
comparison 2026") before committing to either, since the local
database can go stale and this is a concrete install decision, not
just a style-reference lookup. Findings: both MIT-licensed and fully
tree-shakeable; Lucide has ~16x Phosphor's npm downloads/week, is the
default icon set for shadcn/ui (the de facto React ecosystem standard
per the search results), and has the more geometrically strict/dense
look that fits this MASTER.md's "Trust & Authority" style better than
Phosphor's rounder, friendlier multi-weight aesthetic. **Decision:
`lucide-react`**, overriding the local database's Phosphor suggestion
— exactly the kind of case DESIGN_LOOP.md's research step exists for
(don't default to the first result; verify before implementing).

**Brand marks — research:** web search + WebFetch on
github.com/simple-icons/simple-icons confirmed a CC0-1.0 license
(public-domain SVG artwork, standard brand-trademark disclaimer
applies same as any "Sign in with Google"-style button showing a
real logo) — built specifically for representing third-party
brands/integrations, satisfying DESIGN_LOOP.md's licensing
constraint. Verified by inspecting the actual npm tarball
(`npm pack simple-icons@16.27.0`, not just trusting search-result
prose) that `icons/quickbooks.svg`, `icons/googledrive.svg`, and
`icons/zoho.svg` genuinely exist in the package. **Tally has no entry**
— checked the same way (`tar -tzf ... | grep -i tally`, zero matches).
Per the licensing constraint's explicit prohibition on scraping or
hand-approximating a trademarked logo, Tally's card
(`AccountingSoftwaresContent.tsx`) uses a generic Lucide `Calculator`
icon instead of a fabricated brand mark — a real gap with no
legitimately-licensed source found, documented rather than worked
around with a fake logo.

**Implementation:** `src/components/icons/BrandIcon.tsx` wraps
`simple-icons`'s named exports (`siQuickbooks`, `siGoogledrive`,
`siZoho`) as a small React component; each renders in that brand's own
official color (e.g. QuickBooks' green), which is standard practice
for representing a third party's own logo and is not a repurposing of
this app's locked `--color-*` tokens — the D0.2 diff check only
compares `globals.css` values, which this never touches.

**Scope — every emoji/glyph-as-icon instance across the app, not just
D1.1's named examples:** grepped the full `src/` tree for emoji
ranges, arrow/geometric-shape Unicode blocks, and HTML entity
arrows/chevrons (`&rarr;`, `&rsaquo;`, etc.) used as icons — found and
replaced ~45 instances across 19 UI component files (nav, empty
states, status badges, close/back buttons, row chevrons, settings
icons) with `lucide-react` icons or the new `BrandIcon`. Confirmed via
repeated greps after each batch that the `src/lib/quickbooks/
postInvoice.ts`, `src/lib/firebase/config.ts`, and `src/store/
quickBooks/quickBooksSlice.ts` emoji hits from the initial scan are
all inside code comments/`console.log` debug strings — not UI, and
inside `src/store`/logic-layer files this pass must not touch — so
correctly left alone.

**Country-code flag emoji — a real constraint found, not a stylistic
choice:** `src/lib/countryCodes.ts` held a `flag` field (flag emoji
per country) rendered inside `RegisterForm.tsx`'s native `<select>`/
`<option>` phone country-code picker. A native `<option>` can only
render plain text — no `<img>`/SVG/component — so this can't be fixed
by swapping in an icon component without also rebuilding the whole
dropdown as a custom listbox, a materially larger change than an icon
swap. Decision: drop the flag glyph and show `{name} ({code})` as
plain text instead (e.g. "Afghanistan (+93)") — satisfies the
no-emoji guardrail, keeps the native `<select>`'s built-in keyboard/
screen-reader behavior intact, and is the smallest complete fix for
this specific technical constraint. The now-unused `flag` field was
removed from the `CountryCode` interface and all 127 data rows rather
than left as dead data.

## D1.2 — Collapsible sidebar

**Research:** `--domain ux` query for "collapsible sidebar navigation
icon-only rail" returned no directly on-topic rows (closest matches
were generic nav guidelines: sticky nav padding, breadcrumbs, back-
button history — noted as a genuine 0-relevant-result case rather than
stretched into a citation). Followed DESIGN_LOOP.md's fallback: real
web search for "collapsible sidebar dashboard SaaS icon-only rail UX
pattern 2026 toggle placement." Findings adopted: (1) icon-only
collapsed rail (not fully hidden) is the standard pattern, sized to
fit a 24px icon with ~20px padding each side (→ 64px, Tailwind `w-16`,
same math the search results gave); (2) the preference persists in
localStorage; (3) collapsed icon-only items get tooltips (native
`title` + `aria-label` here — a full custom tooltip component would be
new UI-primitive scope beyond this task's own header/nav toggle work);
(4) the toggle control itself commonly uses a dedicated open/close
icon pair and sits in the header row — `lucide-react` ships exactly
this as `PanelLeftClose`/`PanelLeftOpen`, confirmed present before
using them.

**Transition timing:** no direct "sidebar width" motion entry in the
local gsap/motion domain; used the closest analogous guidance already
surfaced in D0.5 (150–300ms standard-tier transitions) — implemented
as a plain CSS `transition-[width] duration-200 ease-in-out` on the
`<aside>`, not a GSAP tween, since this is a simple one-property width
change already well-served by CSS and the app has no GSAP dependency
installed; pulling one in for a single width transition would be a
new dependency for no real benefit.

**Persistence:** implemented via two new small synchronous functions
in `src/lib/storage.ts` (`getSidebarCollapsed`/`setSidebarCollapsed`),
reusing that file's existing private `getItem`/`setItem` helpers —
already individually guarded with `typeof window !== "undefined"`, so
no new SSR-unsafe call was introduced. Deliberately synchronous (the
file's auth/session helpers are async, mirroring mobile's AsyncStorage
API) since a UI toggle's own local state doesn't need Promise
plumbing. `AppShell.tsx` reads the stored value inside a `useEffect`
(post-mount), not inside `useState`'s initializer — reading
`localStorage` during the initializer would run on the very first
client render and mismatch the server-rendered (always-expanded)
markup, which is exactly the class of hydration bug AGENTS.md already
flags this codebase as having hit once before. The trade-off is a
one-frame flash from expanded→collapsed on load for a returning user
with the collapsed preference saved — standard, accepted behavior for
localStorage-persisted UI prefs across the industry, and never a
prerender crash.

**Scope of the collapsed state:** company switcher dropdown and text
labels hide (need width to render); nav icons, the profile-link
initial-avatar, and the logout icon stay and gain `title`/`aria-label`
tooltips. Collapsing is purely a `src/components/shell/AppShell.tsx` +
`src/lib/storage.ts` change — no `src/store/` or `*Api.ts` edits.

## D1.3 — Destructive-action and error dialogs

**Research:** `--domain ux` query for "confirmation modal destructive
action toast notification" returned three directly relevant rows:
confirm before delete/irreversible actions (High severity — "Are you
sure" modal, not a direct delete), toast notifications should
auto-dismiss in 3-5s and never persist indefinitely, and successful
actions should get a brief confirmation rather than silent success.
Adopted directly: **confirmations stay a blocking modal** (matches
DESIGN_TASKS.md's explicit "preserve the exact same
blocking-until-dismissed behavior" requirement), **everything else
becomes an auto-dismissing toast** (4000ms — inside the researched
3-5s window) rather than another modal, since forcing a click to
dismiss every success/error message a user didn't ask a yes/no
question about would be a regression from a fast SaaS product, not an
improvement over `window.alert`.

**Architecture — reused an existing codebase pattern rather than
inventing a new one:** `src/lib/sessionManager.ts` already uses a
module-level `eventemitter3` instance (`sessionEmitter`) so plain,
non-component code can trigger cross-cutting UI behavior without React
context plumbing — `eventemitter3` was already a direct dependency
for exactly this reason. `src/lib/dialogManager.ts` mirrors that same
shape: `confirmDialog(options): Promise<boolean>` and
`showToast(message, tone)` are plain functions any client component's
event handler can call directly, no hook/provider import needed at
each of the ~30 call sites. `src/components/ui/DialogHost.tsx` is the
one subscriber, mounted once in `src/app/providers.tsx` (wraps every
route, including pre-auth pages like `/login`). `confirmDialog`
resolves its Promise only on the dialog's own button click — the same
"caller awaits, execution pauses" contract `window.confirm` had.

**Visual design:** reuses the existing `Button` primitive's
`primary`/`outline`/`danger` variants (destructive confirms get
`danger`) and the locked palette's `--color-error`/`--color-success`
tokens for toast icon tinting — no new colors introduced. Modal uses
`shadow-xl` (Tailwind's default, not a new token) — see D2.1 for why a
dedicated elevation-token scale is deferred to that task rather than
introduced piecemeal here.

**Accessibility baseline:** confirm dialog uses `role="alertdialog"` +
`aria-modal` + labelled title/message, autofocuses its confirm button
on open, and Escape/backdrop-click cancels (same "cancel" outcome a
user expects from dismissing a native dialog). Toasts use
`role="status"`/`aria-live="polite"` so screen readers announce them
without stealing focus. A full focus trap was not added — out of
scope for this task's own research findings, which centered on the
confirm/toast split rather than modal focus management; flagged as a
candidate for D2.3's accessibility pass if a gap is found there.

**Call-site sweep:** replaced all 34 `window.alert`/`window.confirm`
call sites found via `grep -rn` across 12 files. One file,
`src/store/useLogout.ts`, sits inside the `src/store/` directory the
Cycle's mechanical gate greps for — flagged explicitly rather than
silently changed: DESIGN_LOOP.md's own Cycle step 4 scopes this pass
to "presentation only... **and the specific UI-layer call sites that
currently trigger `window.alert`/`window.confirm`**" as an explicit
inclusion, distinct from the "business logic, API contracts" it
excludes. The diff there is exactly two `window.alert(...)` →
`showToast(...)` swaps; `dispatch(logoutUser(...))` and
`router.replace(...)` — the actual logic — are untouched. Verified via
`git diff -- src/store/` showing only that 4-line change before
committing.

## D2.1 — Spacing/type/radius/elevation token consistency

**Audit method:** grepped the full `src/components`/`src/app` tree for
every category of one-off value the task names: raw hex colors
(`#[0-9A-Fa-f]{6}`), arbitrary pixel spacing (`p-[Npx]` etc.),
arbitrary pixel border-radius, and arbitrary pixel font sizes
(`text-[Npx]`) — then read each hit's surrounding context individually
rather than mass-replacing by pattern match, since not every hardcoded
value is actually drift (see below).

**Elevation — the real, confirmed gap from D0.5:** `globals.css` had
no shadow scale at all; 28 `shadow-sm` + 2 `shadow-xl` Tailwind
utility call sites across the app relied on Tailwind's un-themed
defaults. Added `--shadow-sm/md/lg/xl` to the `@theme` block using
MASTER.md's researched values verbatim. Tailwind v4 generates its
`shadow-*` utilities *from* `--shadow-*` theme variables the same way
this file's existing `--radius-*` block already documents for
`rounded-*` — so every existing `shadow-sm`/`shadow-xl` call site
picked up the token automatically with zero component-file changes.
Verified in the built CSS output (`.next/static/chunks/*.css`):
`.shadow-sm` resolves to `0 1px 2px ... #0000000d` (0.05 alpha) and
`.shadow-xl` to `0 20px 25px ... #00000026` (0.15 alpha) — exactly the
new token values.

**Hex-color audit — found ~40 raw hex values, fixed the ones that were
real drift, left the rest:** the vast majority (role badges in
`TeamMembersContent.tsx`, status-pill tints in
`PendingInvoicesContent.tsx`/`DashboardContent.tsx`/
`ProfileContent.tsx`, the invoice-preview viewer's dark chrome) are
deliberate supplementary/categorical accents that don't duplicate any
locked `--color-*` value — e.g. three distinct owner/admin/accountant
badge colors are an intentional categorical system, not accidental
duplication, and systematizing every incidental badge tint into a new
named token would be a redesign beyond "fix the known drift." Two
real duplications were found and fixed: (1) `InvoiceReviewContent.tsx`
hardcoded `#E5484D` for an error-state field border in four places,
literally inconsistent with the `text-error` class used one line away
in the same ternary for the same error condition — replaced all four
with `var(--color-error)`. (2) The same file's primary action button
had a redundant, conflicting disabled-state treatment: an inline
`backgroundColor: "#B8B8B8"` override stacked on top of the
`disabled:opacity-45` Tailwind class already handling dimming (the
sibling Reject button only uses the opacity class) — removed the
hardcoded override so both footer buttons share one disabled-state
mechanism.

**Type-scale audit:** found two `text-[10px]` badge labels ("MOST
POPULAR", the paywall's reason-code tag) below the smallest defined
step (`--text-caption` = 12px) — bumped both to `text-caption`.

**Spacing/radius audit:** no arbitrary pixel border-radius found. The
only arbitrary pixel spacing found was five `[2px]` micro-adjustments
on pill-badge vertical padding, below `--space-xs` (4px) — left as-is,
since no token covers that granularity and these are optical
fine-tuning, not a case of "should have used an existing token."

**UI primitives confirmed already correct:** `Button`/`Card`/`Badge`/
`Input` (`src/components/ui/`) already reference `--space-*`/
`--radius-*`/`--text-*` tokens consistently with no raw hex — no
changes needed here; D2.3 covers their accessibility properties
separately.
