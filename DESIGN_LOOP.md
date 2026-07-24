# DESIGN_LOOP.md — Scantrix Web: Production-Grade Visual Pass

Distinct from LOOP.md/TASKS.md/ASSUMPTIONS.md/PROGRESS.md/STATUS.md/
FINAL_REPORT.md, which already exist on this branch from last night's
feature-build loop. Do not read those as instructions for tonight — do
read FINAL_REPORT.md and STATUS.md once, in Phase 0, purely for context
on what already exists. Do not overwrite any of those files. Tonight's
loop writes its own state files: DESIGN_PROGRESS.md, DESIGN_STATUS.md,
DESIGN_FINAL_REPORT.md.

## Mission

Every page built last night is functionally correct but visually looks
AI-generated: system emoji standing in for icons and brand logos, an
inconsistent spacing/shadow/radius language between pages, a sidebar
that can't collapse, and native unstyled `window.alert`/`window.confirm`
popups for every destructive action and error. Tonight's job is to make
this feel like a real, professional SaaS product a paying customer
would trust, not a prototype.

**One locked constraint, non-negotiable:** the color palette does not
change. The client has explicitly approved the current colors, both in
the mobile app and as ported into this web app's `@theme` block in
`src/app/globals.css`. Every other visual dimension — spacing, type
scale, iconography, motion, layout density, component style — is open.

**How this loop is different from last night's:** last night's tasks
told the agent what to build. Tonight's tasks tell the agent what
problem to solve and what tool to use to solve it well, then trust it
to research, decide, and implement. Every visual task in Phase 2+
follows this shape: state the problem → run real research (the
ui-ux-pro-max skill's search tool, and/or web search) → make a
reasoned decision → implement it → document why in
DESIGN_ASSUMPTIONS.md. Do not skip the research step and default to
whatever seems obvious — that is exactly how the current AI-generated
look happened the first time.

## The Cycle

1. Pick the first unchecked task in DESIGN_TASKS.md.
2. For any visual/UX decision, research first (see "Research tools"
   below) before writing code. Cite what the research returned in
   DESIGN_ASSUMPTIONS.md before implementing based on it.
3. Implement the smallest complete change that solves the stated
   problem.
4. Gate, every commit, no exceptions:
   - `npx tsc --noEmit && npx next build` both exit 0.
   - Run `git diff -- src/app/globals.css` and confirm every existing
     `--color-*` custom property's hex/oklch VALUE is byte-identical
     to before this task started. New tokens may be added if a real
     gap is found (e.g. a missing hover/disabled state shade), but no
     existing color value changes. If this diff shows any existing
     color value changed, that is a hard stop — revert the color
     change specifically and keep the rest of the task's work only if
     it's separable; otherwise revert the whole task.
   - Grep the diff for any change inside `src/store/` or any
     `*Api.ts` thunk file. This pass touches presentation only — UI
     components, CSS, icons, animation, and the specific UI-layer
     call sites that currently trigger `window.alert`/`window.confirm`.
     It does not touch business logic, API contracts, or the FormData/
     File upload handling that was bug-fixed last night. If a task
     seems to require a logic-layer change, stop and mark it BLOCKED
     with the reason instead of making the change.
5. Green: commit `<task-id>: <summary>`, check the box, append a line
   to DESIGN_PROGRESS.md.
6. Red: fix, max 3 attempts, then `git checkout .`, mark
   BLOCKED(reason), move on.
7. One task per commit.

## Research tools — use real ones, don't guess

**ui-ux-pro-max skill.** Locate it first (check `.claude/skills/`, or
search the filesystem for a `SKILL.md` whose frontmatter name is
`ui-ux-pro-max`). If found, its search script is the primary research
tool for style, spacing, typography, icon conventions, motion, and
navigation-pattern decisions:

```bash
python "${CLAUDE_PLUGIN_ROOT}/.claude/skills/ui-ux-pro-max/scripts/search.py" "<query>" --design-system --persist --output-dir "<repo-root>" -p "Scantrix Web"
```

Run this once early (Phase 0) to generate a persisted design system
doc at `design-system/scantrix-web/MASTER.md` — this becomes a real,
reviewable artifact of the design decisions made tonight, not just
prose in a report. Use `--domain icons`, `--domain ux`, `--domain
typography`, `--stack nextjs`, etc. for supplementary lookups per
task, per the skill's own documented workflow.

**Critical constraint on this tool:** its `--design-system` output
will include color palette recommendations. Ignore them entirely for
color selection — only use its color-domain output for accessibility
validation of the EXISTING locked palette (contrast ratios, semantic
pairing), never to choose new hex values.

**If the skill genuinely isn't present in this environment:** don't
block on it. Note that in DESIGN_ASSUMPTIONS.md and rely on real web
search instead for the same categories of decisions (current icon
library conventions in professional SaaS, sidebar collapse patterns,
etc.) — the research requirement doesn't go away, only the specific
tool does.

**Web search.** Use it for anything the skill's local database doesn't
cover well: which icon set to actually source real third-party brand
marks from, current conventions for collapsible sidebars in
professional tools, whatever a specific task calls for.

**Any browser/screenshot MCP tool, if connected.** Check what's
available before Phase 1. If something exists that can render a page
and capture it, use it after each significant visual change to
self-review before committing — this is the closest thing this loop
has to a real quality gate for appearance, since `tsc`/`next build`
cannot detect whether something looks good. If nothing like this is
available, say so explicitly in DESIGN_FINAL_REPORT.md rather than
silently skipping visual verification — that becomes the human's
required first check in the morning instead.

## Licensing constraint on real icons/logos

Never scrape a logo image directly from a company's website, and never
hand-draw an approximation of a trademarked logo. Source real
third-party brand marks (QuickBooks, Google Drive, Tally, Zoho, etc.)
only from a legitimately licensed source built for exactly this
purpose — research and confirm the license before using anything.
Generic UI icons (nav, actions, status) have no such restriction; any
well-established open icon library is fine.

## Hard Guardrails

- Colors locked, see Cycle step 4 — this is the one guardrail with a
  mechanical check attached, because it's the one thing explicitly
  promised to the client.
- No emoji anywhere as a UI element — not icons, not logos, not status
  indicators. This applies to every route, not just the ones
  explicitly screenshotted tonight.
- Presentation only — no `src/store/`, no `*Api.ts` logic changes, no
  touching the FormData/File upload handling fixed last night.
- Git only: work stays on branch `web-app-design-polish` (created off
  `web-app-build` in Phase 0). Never commit to `web-app-build` or
  `main` directly. One commit per task.
- **Never deploy to Vercel, never run the `vercel` CLI, from this
  loop, under any condition.** This is intentionally stricter than
  "ask first" — it's a full prohibition for tonight regardless of
  whether every task completes cleanly. Deployment is a human decision
  after visual review, full stop.
- If every task completes and the gate is green: push the
  `web-app-design-polish` branch to origin. Do not merge, do not open
  a PR, do not touch `main` — pushing the branch is as far as this
  loop goes.
- Never resolve the Google/Apple Sign-In issues by rewriting code.
  Google's is a Cloud Console origin-allowlist setting; Apple's needs
  an Apple Developer Services ID. Neither is a code problem, and this
  loop has no credentials to fix either. If a task seems to want you
  to "fix" sign-in, stop, don't touch the sign-in code, and note it's
  already correct per last night's FINAL_REPORT.md.
- Never fabricate a research citation. If a search returns nothing
  useful, say so and fall back to documented reasoning instead of
  presenting a guess as a finding.

## State Files (tonight's own, separate from last night's)

- DESIGN_TASKS.md, DESIGN_PROGRESS.md, DESIGN_ASSUMPTIONS.md,
  DESIGN_STATUS.md (written by the Phase 3 self-audit),
  DESIGN_FINAL_REPORT.md (written at stop).

## Re-anchor Ritual

Re-read this file, then DESIGN_PROGRESS.md's last 20 lines, then
DESIGN_TASKS.md. Resume from the first unchecked box.

## Stop Condition

Every DESIGN_TASKS.md box checked or BLOCKED. Write
DESIGN_FINAL_REPORT.md: what changed per page/component, every
DESIGN_ASSUMPTIONS.md line verbatim, whether visual self-review was
possible (and if not, that this is the human's first task), every
BLOCKED item with its reason, confirmation the color-token diff check
passed on every single commit, not just the last one. Push the branch
per the guardrail above. Stop.

## Zero-Questions Rule

No human is watching. Research, decide, document the reasoning,
proceed. A task that's stuck for a reason other than the two named
exceptions (color-lock violation, logic-layer edit required) gets
BLOCKED and skipped, never paused-and-waiting.
