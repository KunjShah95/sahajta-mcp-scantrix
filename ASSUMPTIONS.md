# ASSUMPTIONS.md

Every judgment call made in place of a missing stakeholder answer.
Append one line per decision as they're made during the loop.

## Seeded before loop start

- No PRD exists. Requirements source is the mobile app's actual code
  at ~/Scantrix_v2 (branch frontend-ui-v2), not a written spec.
- Working branch is `web-app-build` off `main`; nothing is pushed to
  `main` directly by the loop, and nothing is pushed to origin at all
  without human review after the loop stops (this repo currently has
  no PR-review workflow set up — that's a convention to confirm with
  the team, not something the loop should assume either way).
- Backend URLs, Firebase config, and all API contracts are reused
  exactly as they exist in the mobile app / already-ported logic
  layer — nothing about the backend integration is being redesigned,
  only the UI consuming it.
- Subscription pricing is fixed and not open for reinterpretation:
  Trial free/14 days/1 slot; Standard $15mo or $149yr/1 slot;
  Enterprise $30mo or $299yr/3 slots; all plans unlimited
  scans/team members.
- Google Drive integration and Delete Account both remain UI-only
  mockups/stubs in this pass — real backend work for both is
  out of scope tonight, not a decision the loop should second-guess
  or attempt to fully implement.
- Desktop UI is a genuine redesign of information architecture, not a
  1:1 visual port of mobile screens — mobile has no real tab bar, and
  desktop needs its own navigation shell. Colors, spacing, typography
  are ported exactly; layout/IA is not.
