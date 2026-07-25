# DESIGN_PROGRESS.md

Live log, one line per completed task, appended in order. See
DESIGN_TASKS.md for the checklist and DESIGN_ASSUMPTIONS.md for the
research/reasoning behind each decision.

- D0.1: Confirmed `git status` clean on `web-app-build`. Created and
  checked out `web-app-design-polish` from it.
- D0.2: Gate baseline green (`tsc` + `next build`, 20/20 routes).
  Color-token snapshot recorded verbatim in DESIGN_ASSUMPTIONS.md.
- D0.3: ui-ux-pro-max skill found and confirmed runnable (see
  DESIGN_ASSUMPTIONS.md for exact path — `CLAUDE_PLUGIN_ROOT` is unset
  here so the literal absolute path is used all loop). WebSearch/
  WebFetch available. No browser/screenshot MCP tool available —
  flagged for DESIGN_FINAL_REPORT.md as the human's first check.
- D0.4: Read AGENTS.md, STATUS.md, FINAL_REPORT.md. Confirmed: 20
  routes exist per last night's build, AppShell.tsx is the sidebar
  component D1.2 targets, `src/lib/storage.ts` is the existing
  SSR-safe localStorage pattern D1.2 must reuse, and the cross-cutting
  `window.alert`/`window.confirm` note in FINAL_REPORT.md lists every
  known call site D1.3 needs to find and replace.
- D0.5: Persisted `design-system/scantrix-web/MASTER.md`. Color output
  discarded per guardrail. Decisions: keep Geist typeface (researched
  alternatives documented, not adopted — reasoning in
  DESIGN_ASSUMPTIONS.md); existing `--space-*`/`--radius-*` tokens
  confirmed correct as-is; new `--shadow-sm/md/lg/xl` elevation tokens
  identified as a real gap, to be added in D2.1; icon direction
  (SVG icon set, no emoji) confirmed, deeper research deferred to D1.1.
- D1.1: Installed `lucide-react` (generic icons, researched over
  Phosphor via web search) and `simple-icons` (CC0, licensed brand
  marks). New `src/components/icons/BrandIcon.tsx` wraps
  QuickBooks/Google Drive/Zoho marks; Tally has no licensed source so
  gets a generic Calculator icon instead of a fabricated logo.
  Replaced ~45 emoji/glyph-as-icon instances (raw emoji, HTML entity
  arrows/chevrons, geometric-shape Unicode) across 19 UI files with
  Lucide icons. Dropped the country-picker's flag-emoji field (native
  `<select><option>` can't render SVG) in favor of plain
  `{name} ({code})` text. Gate green, color-token diff clean, no
  src/store or *Api.ts changes.
- D1.2: `AppShell.tsx` sidebar now collapses to a 64px icon-only rail
  (researched pattern: icon rail + tooltips + persisted preference,
  toggle via `PanelLeftClose`/`PanelLeftOpen`). Preference persisted
  via two new synchronous functions in `src/lib/storage.ts`, reusing
  its existing guarded `getItem`/`setItem` — read in a `useEffect`
  post-mount to avoid a hydration mismatch against the server's
  always-expanded markup. CSS width transition, 200ms. Gate green,
  color-token diff clean.
- D1.3: Built `src/lib/dialogManager.ts` (eventemitter3 singleton,
  mirrors the existing `sessionManager.ts` pattern) +
  `src/components/ui/DialogHost.tsx`, mounted once in providers.tsx.
  `confirmDialog()` is a Promise-based blocking modal (destructive
  actions get `danger`-variant buttons); `showToast()` is a
  4s-auto-dismiss notification for everything else. Replaced all 34
  `window.alert`/`window.confirm` call sites across 12 files,
  including 2 in `src/store/useLogout.ts` (explicitly allowed —
  UI-layer call site only, dispatch/router logic untouched, documented
  in DESIGN_ASSUMPTIONS.md). Gate green, color-token diff clean, no
  `*Api.ts` touched.
- D2.1: Added `--shadow-sm/md/lg/xl` elevation tokens to
  `globals.css`'s `@theme` block (Tailwind v4 auto-generates
  `shadow-*` utilities from them, so all 30 existing `shadow-sm`/
  `shadow-xl` call sites picked up the tokens with zero component
  changes — verified in built CSS output). Audited ~40 raw hex color
  usages across the app; fixed 2 real cases of token duplication
  (`#E5484D` error-red → `var(--color-error)`, 4 places in
  InvoiceReviewContent.tsx; removed a redundant hardcoded disabled-
  button gray) and left deliberate categorical/badge accent colors
  alone. Bumped 2 sub-scale `text-[10px]` labels to `text-caption`.
  No arbitrary-radius drift found; UI primitives already token-clean.
  Gate green, color-token diff clean (additive only).
- D2.2: Built `Spinner`/`Skeleton`+`SkeletonListRows`/`EmptyState`/
  `ErrorState` shared components. `Spinner` consolidated 5 already-
  duplicated inline spinner spans. Applied skeleton loading + error-
  with-retry to Dashboard recent invoices, invoices list, pending
  queue, and team members (using its existing but previously-inert
  `membersError` state). Applied blocking `Spinner` consistently to
  invoice detail/review/vendor full-page loads. Vendor resolution's
  vendor/account/tax-code lists got skeletons only, no error state —
  `quickBooksSlice` has no error field for those thunks, flagged
  rather than adding one (would be a src/store change). Gate green,
  color-token diff clean.
- D2.3: Computed real WCAG contrast ratios (not eyeballed) for every
  Button/Badge variant. Found and fixed two real AA failures already
  shipping: Button's default `primary` variant (white-on-teal,
  2.52:1) and Badge's `warning`/`success` variants (2.15:1/3.30:1) —
  fixed by swapping text color to the existing `--color-text-primary`
  token, zero background/palette changes (`globals.css` diff empty
  this commit). Also fixed Button's loading spinner being hardcoded
  white (invisible on the `outline` variant) — now variant-aware.
  Bumped Button's `sm` size from 36px to 44px (touch-target minimum).
  Added `focus-visible` ring to Button (previously had none). Card/
  Badge confirmed non-interactive, no target/focus changes needed.
  Gate green, color-token diff empty.
- D3.1: Wrote DESIGN_STATUS.md — audited all 20 routes + `/_not-found`
  by reading code (no browser tool available, per D0.3). 19/20 real
  routes meet the new bar; `/_not-found` doesn't (no custom page
  exists at all). Populated Phase 4 with 4 concrete tasks: D4.1
  (password-toggle icon on login/register), D4.2 (themed 404 page),
  D4.3 (placeholder metadata title/description), D4.4 (remove 5 dead
  scaffold SVGs). Docs-only commit, gate re-confirmed green.
- D4.1: Added `Eye`/`EyeOff` icons alongside the existing "Show"/"Hide"
  text in `LoginForm.tsx` and `RegisterForm.tsx`'s password toggle
  buttons (kept the text too — smallest change, no behavior/layout
  change, just icon + aria-label added). Gate green, color-token diff
  clean.
- D4.2: Added `src/app/not-found.tsx` — themed 404 (icon, tokens,
  "Back to Dashboard" link) in place of Next.js's unstyled default.
  Confirmed via `AuthGate.tsx`'s existing redirect logic that
  unauthenticated visitors still redirect to `/login` unchanged;
  authenticated visitors see this page inside the normal `AppShell`.
  No AuthGate changes. Gate green, color-token diff clean.
- D4.3: Replaced `layout.tsx`'s create-next-app placeholder
  title/description with real copy pulled from README.md's own
  product description. Gate green, color-token diff clean.
- D4.4: Removed `public/{file,globe,next,vercel,window}.svg` —
  confirmed unreferenced anywhere in `src/` before deleting. Gate
  green, color-token diff clean. All Phase 4 tasks complete.
- D5.1: Clean-cache final gate pass (`rm -rf .next`, then `tsc` +
  `next build` both green, 20/20 routes + `/_not-found`). Diffed every
  `--color-*` token in `globals.css` between the branch's base commit
  and HEAD directly (not just per-commit spot checks) — all 13 values
  byte-for-byte identical; only one commit (D2.1) ever touched the
  file, adding new `--shadow-*` tokens only. Working tree clean, 15
  commits total, one per task.
- D5.2: Wrote DESIGN_FINAL_REPORT.md — what changed per page/
  component, DESIGN_ASSUMPTIONS.md reproduced verbatim (matching last
  night's FINAL_REPORT.md precedent), visual self-review status
  (not possible, flagged as human's first task), confirmation zero
  BLOCKED items, color-token diff re-confirmed clean across every
  commit, MASTER.md's key decisions summarized. Docs-only, gate
  re-confirmed green.
- D5.3: Pushed `web-app-design-polish` to origin (new branch, tracking
  set up). No merge, no PR opened, `main` untouched, no Vercel/deploy
  invocation at any point tonight. All 21 DESIGN_TASKS.md boxes now
  checked — loop complete.
