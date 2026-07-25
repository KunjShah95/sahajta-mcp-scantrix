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
