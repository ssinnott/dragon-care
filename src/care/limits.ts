// The care audits' limits (docs/KEEPERS.md 8), shared by the gallery's audit views and tools/smoke.ts (plain data:
// the smoke test imports it under Node).

/** How far a stroking hand may land from its mark, px (the joints snap to whole pixels). */
export const REACH_MISS = 2.5;
/** The frames a care act may take before an audit calls it stuck: a vignette's (short walks), the yard's (long ones). */
export const ACT_MAX = 2400, YARD_ACT_MAX = 6000;
