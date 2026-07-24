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
