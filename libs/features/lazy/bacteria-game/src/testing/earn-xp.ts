import { PROGRESS_STORAGE_KEY } from '../lib/progress.service';

/** Progress worth `xp` XP from matches alone - `xp / 50` strands of DNA. */
export function progressWorth(xp: number) {
  return { totals: { matchXp: xp } };
}

/** Stores progress worth `xp` XP on this device, for the next service created. */
export function earnXp(xp: number): void {
  localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progressWorth(xp)));
}
