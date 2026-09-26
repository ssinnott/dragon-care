# Orchestration notes (temporary branch; deleted after the merge)

Shared, read-only inputs for the parallel sessions finishing issues #5-#11 on `claude/outstanding-issues-sxr8xo`.

- `plan.md`: the integrated plan. Sections 1-3 are binding for every slice (global rules, decisions, shared reference);
  section 6 has the slices, including the orchestrator addenda S6b, S6c and S9a.
- `handoff.md`: what slices S1-S6 actually built (names, signatures, measured numbers, deviations). The code wins
  where they disagree.
- `implement-slices.js`: the Workflow script the orchestrator runs per slice (implement, two reviewers, verify-and-fix,
  commit with `npm run check` green). Pass `hold: []`; pass `lightReview: true` for one combined reviewer.
- The mission contract (`af25650` on `claude/outstanding-issues-contract`): S8 and S9 branch from it; see the
  "PARALLEL CONTRACT" block at the top of the S8 and S9 sections of `plan.md`.

Nothing on this branch is ever merged into the work branch.
- `miller_mock.png`, `miller_mock_zoom.png`, `miller_mock.patch`: the grumpy miller mockup ("Hob the miller"), drawn
  through the real keeper rig (keeper palette gates pass: 212/212). S9a builds the game's miller from this patch: keep
  its src/art/keeper/* changes (drop the MOCKUP labels and the throwaway `view=millermock` / src/mock/), expose him
  through `npcs.ts` with `drawMiller(ctx, mood: 'grumpy' | 'talkedRound', x, feetY, facing, t)` as artseams.ts
  (contract af25650) spells it. The user asked for him to READ grumpy: keep the folded arms, turned-away stance,
  flat low brows, pout and hmph.
