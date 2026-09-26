# Orchestration notes (temporary branch; deleted after the merge)

Shared, read-only inputs for the parallel sessions finishing issues #5-#11 on `claude/outstanding-issues-sxr8xo`.

- `plan.md`: the integrated plan. Sections 1-3 are binding for every slice (global rules, decisions, shared reference);
  section 6 has the slices, including the orchestrator addenda S6b, S6c and S9a.
- `handoff.md`: what slices S1-S6 actually built (names, signatures, measured numbers, deviations). The code wins
  where they disagree.
- `implement-slices.js`: the Workflow script the orchestrator runs per slice (implement, two reviewers, verify-and-fix,
  commit with `npm run check` green). Pass `hold: []`.

Nothing on this branch is ever merged into the work branch.
