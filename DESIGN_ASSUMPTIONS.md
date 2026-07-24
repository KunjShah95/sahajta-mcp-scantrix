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
