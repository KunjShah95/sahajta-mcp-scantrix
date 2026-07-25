# DESIGN_TASKS.md

## Phase 0 — Setup

- [x] D0.1: Confirm `git status` clean on `web-app-build`. Create and
      checkout branch `web-app-design-polish` from it. All work happens
      here.
- [x] D0.2: Gate baseline: `npx tsc --noEmit && npx next build` both
      exit 0 before any change. Snapshot the current
      `--color-*` values from `src/app/globals.css` into
      DESIGN_ASSUMPTIONS.md verbatim — this is the reference every
      later color-diff check compares against.
- [x] D0.3: Locate the ui-ux-pro-max skill per DESIGN_LOOP.md's
      "Research tools" section. Report whether found. Check what
      web search and any browser/screenshot MCP tools are actually
      available in this session — report exactly what's usable
      before proceeding.
- [x] D0.4: Read AGENTS.md, FINAL_REPORT.md, STATUS.md for context on
      what already exists — do not re-derive the app's structure from
      scratch, it's already documented.
- [x] D0.5: Run the design-system search (per DESIGN_LOOP.md) for this
      product — a professional B2B SaaS invoice/expense-management
      tool for accountants and small business owners, dashboard-heavy,
      trust-and-accuracy-oriented — with `--persist` to produce
      `design-system/scantrix-web/MASTER.md`. Remember: ignore any
      color recommendations from this step entirely.

## Phase 1 — Research-then-decide on the three named problems

Each of these is a real, specific complaint from the person who's
actually looked at the running app. Research each properly — this
means running real searches, not defaulting to the first idea — before
implementing. Document the research findings and the resulting
decision in DESIGN_ASSUMPTIONS.md before writing code.

- [x] D1.1: **Icons and brand logos.** Every icon and every third-party
      software logo (QuickBooks, Google Drive, Tally, Zoho, and any
      generic UI icon — nav, actions, status, empty states) currently
      renders as a macOS system emoji. Research a real icon system:
      what generic icon library fits a professional finance/SaaS
      product, and what legitimately licensed source provides real
      brand marks for the named third-party integrations (see
      DESIGN_LOOP.md's licensing constraint). Decide, document why,
      then apply consistently across every route inventoried in
      STATUS.md — this is a global pass, not one page.
- [x] D1.2: **Collapsible sidebar.** The sidebar
      (`src/components/shell/AppShell.tsx`) is always fully expanded
      with no way to collapse it. Research how professional tools
      commonly solve this — icon-only collapsed state vs. full width,
      where the toggle affordance lives, transition timing (the design
      skill's motion guidance is relevant here) — then implement a
      working expand/collapse with the preference persisted
      client-side using this project's existing SSR-safe localStorage
      pattern (`src/lib/storage.ts`) so it survives a refresh without
      breaking prerendering the way an earlier unguarded
      localStorage call already did once in this codebase.
- [x] D1.3: **Destructive-action and error dialogs.** Every logout,
      delete-account, remove-team-member confirmation, and every hard
      API-failure notice currently renders as a bare browser
      `window.alert`/`window.confirm` — a known, previously-flagged
      visual regression from the mobile app's styled alerts. Research
      and build a small themed dialog/toast component consistent with
      the rest of the app's design system (using the locked color
      palette), then replace every such call site. Preserve the exact
      same blocking-until-dismissed behavior for confirmations
      (logout, delete account, remove member) — don't turn a
      confirm-before-destructive-action into a silent auto-dismiss
      toast.

## Phase 2 — Foundation: consistent visual language

- [x] D2.1: Using the design system generated in D0.5 (spacing/
      typography/radius/shadow recommendations, not colors), establish
      or tighten a single consistent set of spacing, type, radius, and
      elevation tokens/utilities and confirm every existing page
      references them rather than one-off values. Fix the specific,
      already-known drift: mobile-inherited screens hardcoded their
      own hex/spacing instead of using shared tokens (this was already
      true on mobile and got ported forward) — resolve it here for the
      web app rather than propagating it further.
- [x] D2.2: Apply consistent loading, empty, and error states across
      every list/detail page (dashboard, invoices list, invoice
      detail/review/vendor, team members, pending queue) — research
      what a well-designed empty/loading state looks like for a
      dashboard-style product, then implement one shared pattern
      rather than a different ad-hoc treatment per page.
- [ ] D2.3: Confirm touch/click target sizing and focus states meet
      the design skill's accessibility priority checks (minimum target
      size, visible focus rings, contrast) across the primitives built
      last night (`src/components/ui/{Button,Card,Input,Badge}.tsx`)
      before those get reused everywhere else — fixing it once here is
      cheaper than fixing it per-page later.

## Phase 3 — Self-audit and page-by-page pass

- [ ] D3.1: With the foundation from Phase 1–2 in place, enumerate
      every route already built (cross-reference STATUS.md's 19+
      screens) into DESIGN_STATUS.md with a column for whether it now
      meets the new visual bar or still needs specific work. If a
      browser/screenshot tool is available, capture each route to make
      this judgment concretely rather than by reading code alone.
      Append one D4.x task below per route that still needs
      page-specific work — be specific about what's actually wrong on
      that page, not a generic "polish this."

## Phase 4 — Page-specific fixes

*(Populated by D3.1. Do not pre-guess these — the self-audit
determines what's actually still needed once the foundation work is
done.)*

## Phase 5 — Close-out

- [ ] D5.1: Final full gate pass across all routes: `tsc` + `next
      build` clean, color-token diff clean against the D0.2 snapshot
      for every commit made tonight (not just the last one).
- [ ] D5.2: Write DESIGN_FINAL_REPORT.md per DESIGN_LOOP.md's Stop
      Condition, including the design-system MASTER.md's key
      decisions summarized for a human skimming in the morning.
- [ ] D5.3: Push `web-app-design-polish` to origin. Do not merge, do
      not deploy.
