// The player's barn in the browser (docs/BASE_DESIGN.md 7): the one file that touches localStorage. Only a live page
// that may save uses it, and only from BaseView.attach() (a frozen page, t=, a preset page, save=0 and every headless
// check never do: plan G4, G5). A save is save.ts's JSON under one key; one this build can't read -- another
// version, or not a save at all -- is copied to a backup key and a new barn starts, without throwing. Storage that
// isn't there (a private window, a quota, a blocked origin) reads as no save and writes as a failed write.
import { SAVE_VERSION } from './save.ts';
import type { SaveV } from './save.ts';

/** Where the barn is kept, and where a save that didn't fit is kept aside. */
export const SAVE_KEY = 'dragon-care/base', BACKUP_KEY = 'dragon-care/base.bak';

/** What a load found: nothing; a save of this version; one of another version (`old`); something that isn't a save (`bad`). */
export type LoadNote = 'none' | 'ok' | 'old' | 'bad';

function store(): Storage | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}

/** Copy the save as it is to the backup key (a save that didn't fit: kept, not lost, when a new barn starts). */
export function backupSave(): void {
  const s = store();
  try { const raw = s?.getItem(SAVE_KEY); if (s && raw != null) s.setItem(BACKUP_KEY, raw); } catch { /* nothing to keep it in */ }
}

/**
 * The barn as saved: `ok` with the save, or no save and why -- `none` (never saved), `old` (another version) or `bad`
 * (not JSON, or not a save). An old or bad save is copied to BACKUP_KEY. Never throws. (A save of this version whose
 * insides are broken is found only by CareSim.fromSave; the caller backs it up the same way: backupSave.)
 */
export function loadSave(): { save: SaveV | null; note: LoadNote } {
  const s = store();
  let raw: string | null = null;
  try { raw = s ? s.getItem(SAVE_KEY) : null; } catch { raw = null; }
  if (raw == null) return { save: null, note: 'none' };
  let v: unknown;
  try { v = JSON.parse(raw); } catch { backupSave(); return { save: null, note: 'bad' }; }
  if (!v || typeof v !== 'object' || Array.isArray(v)) { backupSave(); return { save: null, note: 'bad' }; }
  if ((v as { v?: unknown }).v !== SAVE_VERSION) { backupSave(); return { save: null, note: 'old' }; }
  return { save: v as SaveV, note: 'ok' };
}

/** Keep the barn; false if the browser wouldn't (no storage, or full). */
export function writeSave(save: SaveV): boolean {
  const s = store();
  if (!s) return false;
  try { s.setItem(SAVE_KEY, JSON.stringify(save)); return true; } catch { return false; }
}

/** Forget the barn (NEW: the next load starts a new one). The backup is kept. */
export function clearSave(): void {
  const s = store();
  try { s?.removeItem(SAVE_KEY); } catch { /* nothing to clear */ }
}
