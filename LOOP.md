# LOOP.md — Expense-Management-web-app (Scantrix Web Port)

## Mission

Convert the Scantrix mobile app (React Native/Expo, repo Scantrix_v2,
branch frontend-ui-v2) into a genuinely web-native Next.js application,
reusing the already-ported logic layer (auth/invoice/vendor/quickBooks
redux slices, api client, storage, sessionManager — all in
src/store/ and src/lib/, committed at 7fe0015) and matching the mobile
app's color palette and design language.

Mode: BUILD. Gate = compile/build check only. Tests deferred to a
future verify loop.

There is no requirements document. The requirements source is the
mobile app's actual code at ~/Scantrix_v2 (branch frontend-ui-v2) — its
screens, its theme tokens, its API contracts. Read the mobile source
directly when a task needs to know what a screen looks like or does.
Do not invent behavior the mobile app doesn't have; do not skip
behavior the mobile app does have.

## The Cycle

1. Pick the FIRST unchecked task in TASKS.md.
2. Re-read whatever mobile source file(s) the task cites.
3. Implement the smallest complete change. No stubs, no TODOs, no
   half-built screens — except for the explicitly pre-marked BLOCKED
   items, which get a real, working stub (loading state, disabled
   button, clear "Coming Soon" UI) not a broken half-feature.
4. Run the gate: `npx tsc --noEmit && npx next build`. Both must exit
   0. tsc alone is NOT sufficient — this project has already had one
   real SSR crash (redux-persist touching localStorage during
   prerender) that tsc did not catch and next build did. Always run
   both.
5. Green: commit `<task-id>: <summary>`, check the box in TASKS.md,
   append one line to PROGRESS.md (task id, what changed, files
   touched).
6. Red: fix, max 3 attempts. Still red after 3: `git checkout .` to
   revert to the last commit, mark the task BLOCKED(reason) in
   TASKS.md, move to the next task. Never leave the tree in a broken
   state between tasks.
7. One task per cycle. Never batch multiple checkboxes into one
   commit.

## Hard Guardrails

- **Git is the undo button.** Work on branch `web-app-build` (created
  in Phase A off `main`), never commit directly to `main`, never
  force-push, never rewrite history. One commit per task, always.
- **Never deploy to production.** No Vercel deploy, no `vercel` CLI
  invocation, from this loop, ever. Deployment is a human decision
  after review.
- **This app's real production systems**: `api.savetrix.com` (main
  backend), the Cloud Run QuickBooks proxy host, Firebase project
  `scantrix-3d179`, and QuickBooks itself via Intuit OAuth. Building
  UI that correctly WIRES these API calls is the entire point of this
  port — do that fully, matching the mobile app's contracts exactly.
  What the loop must NOT do is invoke those endpoints itself as a
  self-verification method: no scripted account registration, no
  automated OAuth click-throughs, no test invoice posts against the
  live QuickBooks connection. The gate is `next build` succeeding, not
  a live API call succeeding. Manual end-to-end testing against
  production is a human morning task.
- **App Router server/client boundary — encoded from a real failure
  in this project.** Default every component to a Server Component.
  Add `'use client'` only when the component actually uses a React
  hook, an event handler, or a browser API (window, document,
  localStorage) — the three-question test. Push `'use client'` to the
  smallest leaf component, never to a page or layout root, unless the
  whole page is genuinely interactive top to bottom. Any file touching
  localStorage/window outside of `src/lib/` or `src/store/`'s already-
  guarded helpers needs its own `typeof window !== 'undefined'` check
  or must be pushed behind a client boundary. This is not a style
  preference — this exact class of bug already crashed a prerender in
  this repo once tonight (redux-persist + persistStore at module
  scope). `next build`'s static generation step is the proof it's
  fixed; a component that "compiles" under tsc can still crash the
  server render.
- **Never resolve open stakeholder questions.** Pricing numbers are
  fixed (see ASSUMPTIONS.md) — use them as-is. Anything else genuinely
  undecided (new UX not present in the mobile app, backend contracts
  that don't exist yet) gets built as a clearly-labeled stub or
  reasonable default, recorded in ASSUMPTIONS.md, never silently
  invented and left unlabeled.
- **Never delete, skip, or weaken a gate to pass it.** If `next build`
  fails, fix the actual cause.
- **Never print secrets into committed files.** `.env.local` (real
  values) is gitignored; `.env.local.example` (documentation only,
  already exists) is the only env file that gets committed.
- **Security defaults**: least privilege / shortest lifetime wherever
  a choice exists (session handling, any generated link). Flag the
  choice in ASSUMPTIONS.md.
- **New dependencies** only when a task is genuinely impossible
  without one; record each with its reason in ASSUMPTIONS.md.
- **TASKS.md edits** limited to checking boxes, adding BLOCKED
  annotations, and the self-audit task appending new gap-tasks. Never
  reorder or delete existing tasks.

## State Files

- TASKS.md — the task list, source of truth for what's done
- PROGRESS.md — one line per completed task, append-only
- ASSUMPTIONS.md — every judgment call made in place of a missing
  stakeholder answer
- STATUS.md — written by the self-audit task (Phase B), mobile-vs-web
  feature parity table
- FINAL_REPORT.md — written at the end

## Re-anchor Ritual

Feeling lost, or resuming after a context reset: re-read this file,
then the last 20 lines of PROGRESS.md, then TASKS.md. Resume from the
first unchecked box. Trust the files over memory — the files are the
actual state, your memory of "what I was doing" is not reliable
across a compaction.

## Stop Condition

Every box in TASKS.md is either checked or BLOCKED. Then: write
FINAL_REPORT.md (what was built, per feature, with file paths; every
line of ASSUMPTIONS.md verbatim; every BLOCKED item with its reason
and the exact next step a human needs to take), final commit, stop.

## Zero-Questions Rule

There is no human watching this run. If you're stuck on something
that isn't a stakeholder-gated or credential-gated item, make the
smallest reasonable decision, record it in ASSUMPTIONS.md, and
continue. Stuck means BLOCKED-and-move-on, never a pause waiting for
input.
