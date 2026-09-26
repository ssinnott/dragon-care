// Ambient globals. A plain script-scoped .d.ts (no top-level import/export), so this merges with the DOM's Window.

interface Window {
  /**
   * Debug surface installed by the inline script in index.html before the module graph loads. A headless
   * harness (tools/*.ts) polls `ready` and asserts `errors` is empty; anything else a tool needs to drive
   * the page goes on here too, declared by the module that installs it.
   */
  __dragonCare?: {
    ready: boolean;
    errors: string[];
    /**
     * view=floor (src/gallery.ts): per look and anim, the deepest row below the ground line that anything the
     * dragon draws reaches (ground shadow excluded; 1 = the sole's own anti-aliased ink row), and where.
     */
    floor?: { id: string; anim: string; depth: number; frame: number }[];
    /**
     * view=roots (src/gallery.ts): per look and anim, the least depth (px) either far leg's sunk root disc keeps
     * inside the rest of the silhouette drawn over it, and where; `floats` = under the audit's minimum (1.2 hard
     * rule: roots sunk into the body).
     */
    roots?: { id: string; anim: string; depth: number; frame: number; leg: string; floats: boolean }[];
    /**
     * view=tails (src/gallery.ts): per look and core anim, the most its tail's inked top rises over the back's at the
     * hip, px, and where; `gated` = a tip shape (the fluke) held to the audit's ceiling, `high` = over it (3.0).
     */
    tails?: { id: string; anim: string; over: number; frame: number; gated: boolean; high: boolean }[];
    /**
     * view=pour (src/gallery.ts): per look, its breath's effect component that reaches the floor with the highest top
     * (screen row) against the lip line (the mouth's row + POUR_LIP), and where; `column` = it reaches the lip line (3.8).
     */
    pour?: { id: string; frame: number; top: number; lip: number; column: boolean }[];
    /** view=neutral (src/gallery.ts): per look, the share of its pixels that are neutral (HSV S < 0.25); `over` > 40 % (3.1). */
    neutral?: { id: string; share: number; over: boolean }[];
    /**
     * view=careaudit (src/gallery.ts): per care act and look, the most pixels of the dragon's eye box the keeper covers
     * (K7: never any), where, how far a stroking hand lands from its mark, and whether the act finished.
     */
    care?: { act: string; id: string; covered: number; frame: number; phase: string; miss: number; done: boolean; frames: number }[];
    /**
     * view=base (src/game/base.ts), as of the last frame drawn: the care simulation's step, the camera, the open jobs,
     * the jobs done and the Rushes so far, and the job strip's chips (canvas px) for tapping; the world's digest (the
     * 8-hex FNV-1a hash of src/game/save.ts worldKey: the save's JSON less the seed) and every dragon (its stable id,
     * element, stage, floor and x; what its body is doing, sim.ts DragonMove; the kind of room at its floor and x, or
     * null in the lift bay and the ladder bay; its slot as `kind:index`, or null); the Dragon Lift's car (y, its rider's
     * feet, and the rider's dragon id or null); and the px the dragons have walked in all. Time (S4): the barn's
     * digest (`barnDigest`: the hash of save.ts barnKey, the dragons, keepers, jobs and lift with every absolute clock
     * left out, so two worlds started at different hours but stepped alike agree on it), the clock as the view reads it
     * (day 1-based, hour, minute, the day's phase), the speed (world steps a frame: 0 paused, 1, 2, 4 or 8), whether
     * the page loads and saves the player's barn (`persist`), and the top bar's buttons (canvas px, by name: `new`,
     * `pause`, `speed`). Growing up and eggs (S5): each dragon's `waiting` (it has a job no keeper is at work on yet:
     * a tap on it Rushes that job, where a tap on one not waiting opens its card) and `head` (the middle of its head in
     * canvas px as last drawn, or null when it was not drawn: off screen); the eggs in the Hatchery's nests (each one's
     * element, its nest 0-2 and how far on it is, 0 laid to 1 due); and the name of the dragon whose card is open, or
     * null. The elder garden (S6): each dragon's `place` (`barn`, or retired, `garden`), and the garden's residents, its
     * plots (one a resident or a retiree, at least two) and the world's walkable width out to its end (world px: 1688
     * with two plots, 176 more a plot). The watchable scene (S9): `ui` -- the overlay on screen (`none`, the barn, or
     * `watch`, the team out watched on its road), the TEAM OUT chip's rect while it shows (a trip out, the barn on
     * screen) and the BACK TO BARN button's while watching (canvas px); and `scene`, while a trip is out (null
     * otherwise): the last stop the team reached (`baddie` or its challenge; null before the first), whether it was met,
     * whether its beat is playing, the banner, the baddie on the road (its id, face and pose; null when none is in view),
     * its exit (on a success), the way the team faces (-1 after turning back), how far along the trip is (0..1), and
     * once its time is up, the result card's title. Gone once the base is detached (the page left it).
     */
    base?: { tick: number; camX: number; camY: number; jobs: number; done: number; rushes: number; preempted: number;
      chips: { x: number; y: number; w: number; h: number; dragon: string; need: string; rushed: boolean }[];
      digest: string;
      dragons: { id: number; name: string; element: string; stage: string; place: 'barn' | 'garden'; f: number; x: number; move: string; room: string | null; slot: string | null;
        waiting: boolean; head: { x: number; y: number } | null }[];
      lift: { y: number; rider: number | null };
      walked: number;
      barnDigest: string;
      clock: { day: number; hour: number; minute: number; phase: 'dawn' | 'day' | 'dusk' | 'night' };
      speed: number;
      persist: boolean;
      buttons: Record<string, { x: number; y: number; w: number; h: number }>;
      eggs: { element: string; nest: number; progress: number }[];
      card: string | null;
      garden: { residents: number; plots: number; worldW: number };
      ui: { screen: 'none' | 'watch'; chip: { x: number; y: number; w: number; h: number } | null; back: { x: number; y: number; w: number; h: number } | null };
      scene: { stop: string | null; covered: boolean | null; beat: boolean; banner: string | null; baddie: 'moleking' | 'stormroc' | 'frostgiant' | null;
        face: 'neutral' | 'grumpy' | 'surprised' | 'sleepy' | null; pose: 'walk' | 'stand' | 'sit' | 'turn' | 'leave' | null;
        exit: 'calmed' | 'outwitted' | 'drivenOff' | null; facing: 1 | -1; progress: number; done: boolean; result: string | null } | null };
    /**
     * view=base, live and saving (src/game/base.ts attach, only when the page loads and saves the player's barn): save
     * the barn now, and return the step it was saved at. Gone once the base is detached.
     */
    baseSaveNow?: () => number;
  };
}

interface Window {
  /**
   * Safari still ships the prefixed WebAudio constructors; src/lib/audio/facade.ts falls back to them. The
   * engine declares these in its own types/globals.d.ts, which is outside the src/ tree the subtree vendors,
   * so every consuming game declares them again.
   */
  webkitAudioContext?: typeof AudioContext;
  webkitOfflineAudioContext?: typeof OfflineAudioContext;
}
