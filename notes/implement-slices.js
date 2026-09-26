export const meta = {
  name: 'implement-slices',
  description: 'Implement plan slices in order: build, two-lens adversarial review, verify-and-fix, commit with npm run check green',
  phases: [
    { title: 'Implement', detail: 'one agent builds the slice to its done-definition and commits' },
    { title: 'Review', detail: 'correctness/rules lens and acceptance/experience lens, read-only' },
    { title: 'Fix', detail: 'verify each finding, fix the real ones, checks green, commit' },
  ],
}

const S = args.scratch
const PLAN = `${S}/plan.md`
const HANDOFF = `${S}/handoff.md`
const BRANCH = args.branch
const TRAILER = args.trailer

const COMMON = `Repo: /home/user/dragon-care, branch ${BRANCH} (already checked out; never switch branches, never push, never rewrite history).
The integrated plan for GitHub issues #5-#11 is ${PLAN}. Its sections: 1 global rules, 2 fixed decisions, 3 shared reference, 4 slice order, 5 traceability, 6 the slices, 7 mustFix map, 8 risks.
The handoff log ${HANDOFF} records what earlier slices ACTUALLY built (names, signatures, measured numbers, deviations from the plan). Where it disagrees with plan.md, the handoff log wins for existing code.
Checks: \`npm run check\` = typecheck + palette gates + sim-check + headless smoke (takes several minutes; Chromium via Playwright is preinstalled). Screenshots: \`node tools/shot.ts <out.png>="<query>" --scale 2\` (write them under ${S}/shots/, then LOOK at them with the Read tool).
src/lib/ is vendored: never edit it. No Math.random/Date/performance in src/game (G1).`

const commitRule = (what) => `Commit with git (git add the relevant files, including new ones; never add node_modules, dist or shots). Commit message: a one-line subject "${what}", a blank line, a short body saying what changed and which issues it advances (write "Refs #N", never "Closes"/"Fixes"), then a blank line and exactly these trailer lines:\n${TRAILER}`

const IMPL_SCHEMA = {
  type: 'object',
  properties: {
    baseCommit: { type: 'string', description: 'git rev-parse HEAD before you changed anything' },
    headCommit: { type: 'string', description: 'git rev-parse HEAD after your commit' },
    checkGreen: { type: 'boolean', description: 'npm run check passed on the committed tree' },
    summary: { type: 'string' },
    deviations: { type: 'array', items: { type: 'string' } },
    gaps: { type: 'array', items: { type: 'string' }, description: 'anything in the slice not done, or done as a stand-in' },
  },
  required: ['baseCommit', 'headCommit', 'checkGreen', 'summary', 'deviations', 'gaps'],
}
const FINDINGS_SCHEMA = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['blocker', 'major', 'minor'] },
          file: { type: 'string' },
          line: { type: 'number' },
          title: { type: 'string' },
          scenario: { type: 'string', description: 'concrete inputs/state -> wrong result, or the unmet criterion and the evidence' },
          fix: { type: 'string', description: 'the suggested fix' },
        },
        required: ['severity', 'file', 'title', 'scenario', 'fix'],
      },
    },
    criteriaChecked: { type: 'array', items: { type: 'string' }, description: 'each acceptance criterion / rule checked, with MET or NOT MET and the evidence' },
  },
  required: ['findings', 'criteriaChecked'],
}
const FIX_SCHEMA = {
  type: 'object',
  properties: {
    headCommit: { type: 'string' },
    checkGreen: { type: 'boolean' },
    fixed: { type: 'array', items: { type: 'string' } },
    rejected: { type: 'array', items: { type: 'string' }, description: 'findings judged not real, each with the reason' },
    deferred: { type: 'array', items: { type: 'string' }, description: 'real but minor findings left, each with the reason' },
    openProblems: { type: 'array', items: { type: 'string' }, description: 'anything still broken or unmet' },
  },
  required: ['headCommit', 'checkGreen', 'fixed', 'rejected', 'deferred', 'openProblems'],
}

const results = []
for (const sl of args.slices) {
  const tag = sl.id
  log(`${tag}: implementing — ${sl.title}`)
  const impl = await agent(`${COMMON}

YOUR JOB: implement slice ${tag} ("${sl.title}") of the plan, completely, to its done-definition.
1. Run \`git rev-parse HEAD\` first and remember it (baseCommit).
2. Read plan.md sections 1, 2, 3, 4 and 5 in full, and section 6's "${tag}" subsection in full. Read the WHOLE handoff log. Then read the code you will change before changing it.
3. Build everything the slice lists: code, tests (sim-check sections, smoke cases), tools/shots.ts entries, palette gates, types/globals.d.ts, and the docs updates it names. Every acceptance criterion quoted in the slice must be genuinely met, not stubbed.
4. Follow the plan. Where the plan is wrong about the code, or a simpler design meets the same criteria and rules, you may deviate: record each deviation and its reason. Never drop a criterion, never weaken an existing check without a measured reason written into the doc and the handoff log, and stay in the slice's scope (G15).
5. Run \`npm run check\` and iterate until it is fully green. Render the slice's listed shots and LOOK at every one; fix what looks wrong (the art rules in plan section 1 G6-G8 apply).
6. Append a section "## ${tag} — ${sl.title}" to ${HANDOFF}: what was built; the exported names/types/signatures later slices will use (especially where they differ from plan.md); measured numbers (sim-check output lines); deviations and reasons; gaps and stand-ins; the queries to see it.
7. ${commitRule(`${tag}: ${sl.title}`)}
Return the structured result.`, { label: `${tag}:implement`, phase: 'Implement', schema: IMPL_SCHEMA })

  if (!impl) { log(`${tag}: implementer returned nothing — stopping`); results.push({ slice: tag, stopped: 'implementer failed' }); break }
  const base = impl.baseCommit

  const LENSES = [
    { key: 'correctness', prompt: `LENS: CORRECTNESS AND REPO RULES. Review every change in \`git diff ${base}..HEAD\` (and new files) line by line. Hunt for: real bugs (wrong state transitions, off-by-one, stale references after saves/load, events not cleared, routes that can deadlock or stall, a dragon or keeper that can get stuck, jobs that can never be served); determinism breaks (G1: any Math.random/Date/performance in src/game, iteration not in id order, ties not broken by id, state not in saves (G10), fromSave not relinking); frozen-time contract leaks (G4/G5: storage touched outside attach, smoke live cases without save=0); edits to src/lib (G2); tests that are vacuous, loosened without a measured reason, or not actually exercising the feature; hook/type drift (G9); perf regressions (G14: time BaseView.step if in doubt). Run \`npm run sim\` and \`npm run typecheck\` yourself, and write small throwaway scripts under ${S} to probe suspicious behaviour (e.g. run the sim longer or with other seeds and assert invariants). Only report findings you have evidence for.` },
    { key: 'acceptance', prompt: `LENS: ACCEPTANCE AND PLAYER EXPERIENCE. For every acceptance criterion quoted in the slice section and every traceability row (plan section 5) this slice owns, decide MET or NOT MET from evidence: render the slice's shots (and any others you need, e.g. several consecutive t= frames, other cameras, other hours) with tools/shot.ts into ${S}/shots/${tag}-review/ and LOOK at them; when a criterion is about live input or motion, drive the live page with a small Playwright script (see tools/smoke.ts for how it loads Playwright and starts tools/server.ts). Check the art rules (G6-G8: 1 px ink outline, marks >= 2 px, no gradients, nothing over a dragon's eye, floors pale and gated, night never tints a dragon), HUD layout overlaps at 640x360, readability at 1x, and whether it actually feels like what the user asked for in the issue text. Also check that the docs the slice names were updated truthfully. Only report findings you have evidence for.` },
  ]
  const lensesUsed = args.lightReview ? [{ key: 'combined', prompt: `${LENSES[0].prompt}\n\nALSO, IN THE SAME REVIEW: ${LENSES[1].prompt}` }] : LENSES
  const reviews = await parallel(lensesUsed.map(l => () => agent(`${COMMON}

You are an adversarial REVIEWER of slice ${tag} ("${sl.title}"), just implemented in commits ${base}..HEAD. Read plan.md sections 1-5 and the "${tag}" subsection of section 6, and the handoff log. DO NOT edit any repo file (you may write throwaway files under ${S}).
${l.prompt}
Severity: blocker = an acceptance criterion unmet, a crash, a check that would fail, a determinism/save break, or a hard art rule broken; major = a real bug or a clearly wrong behaviour a player would hit; minor = polish. Return structured findings.`, { label: `${tag}:review:${l.key}`, phase: 'Review', schema: FINDINGS_SCHEMA })))

  const all = reviews.filter(Boolean).flatMap((r, i) => (r.findings || []).map(f => ({ ...f, lens: lensesUsed[i].key })))
  const criteria = reviews.filter(Boolean).flatMap(r => r.criteriaChecked || [])
  log(`${tag}: ${all.length} findings (${all.filter(f => f.severity === 'blocker').length} blockers)`)

  const fixPrompt = (extra) => `${COMMON}

You are the FIXER for slice ${tag} ("${sl.title}"), implemented in commits ${base}..HEAD. Read plan.md sections 1-5 and the "${tag}" subsection of section 6, and the handoff log.
The implementer reported: ${JSON.stringify({ summary: impl.summary, deviations: impl.deviations, gaps: impl.gaps, checkGreen: impl.checkGreen })}
The reviewer(s) reported these findings: ${JSON.stringify(all, null, 1)}
Their criteria verdicts: ${JSON.stringify(criteria, null, 1)}
${extra}
1. VERIFY each finding against the code before acting (reproduce it where you can). Reject the ones that are not real, with the reason.
2. Fix every real blocker and major. Fix real minors when cheap and in scope; otherwise defer them with a reason. Also finish any gap the implementer left that the slice requires.
3. Run \`npm run check\` until fully green; re-render and LOOK at the shots your fixes touch.
4. Append "### ${tag} review" to ${HANDOFF}: what was fixed, rejected, deferred, and any changed names/numbers.
5. If you changed anything: ${commitRule(`${tag}: review fixes`)}
Return the structured result (headCommit = git rev-parse HEAD at the end).`

  const note = (args.resumeNotes || {})[tag] || ''
  let fix = await agent(fixPrompt(note), { label: `${tag}:fix`, phase: 'Fix', schema: FIX_SCHEMA })
  if (!fix || !fix.checkGreen || (fix.openProblems || []).length) {
    log(`${tag}: not clean after the first fix pass — one more`)
    fix = await agent(fixPrompt(`A previous fix pass ended with: ${JSON.stringify(fix)}. Get the slice to done: checks green and every acceptance criterion met.`), { label: `${tag}:fix2`, phase: 'Fix', schema: FIX_SCHEMA })
  }
  results.push({ slice: tag, impl, findings: all.length, blockers: all.filter(f => f.severity === 'blocker').length, fix })
  if (!fix || !fix.checkGreen) { log(`${tag}: still red — stopping before the next slice`); break }
  log(`${tag}: done at ${fix.headCommit}`)
}
return results
