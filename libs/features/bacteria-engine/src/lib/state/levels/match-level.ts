import { LEVELS, playableOnline } from './levels';

/** Whose preference decided a matchmade match's level. */
export type MatchLevelPick = 'waiting' | 'claimer' | 'random';

/** The level of a matchmade match, and whose preference it was. */
export interface PickedMatchLevel {
  levelId: string;
  pick: MatchLevelPick;
}

/** The levels an online match may be played on, in the ladder's order. */
export const MATCH_LEVELS = LEVELS.filter(playableOnline);

/** True for the id of a level that plays online. */
export function isMatchLevel(id: unknown): id is string {
  return MATCH_LEVELS.some((level) => level.id === id);
}

/**
 * The level a matchmade match is played on (ADR 0012): the waiting
 * player's choice, else the claimer's, else a random level that plays
 * online. A choice that is no level playing online - such as a level of a
 * newer build - counts as "any level".
 */
export function pickMatchLevel(
  waiting: string | null,
  claimer: string | null,
  random: () => number
): PickedMatchLevel {
  if (isMatchLevel(waiting)) {
    return { levelId: waiting, pick: 'waiting' };
  }
  if (isMatchLevel(claimer)) {
    return { levelId: claimer, pick: 'claimer' };
  }
  const index = Math.min(
    MATCH_LEVELS.length - 1,
    Math.max(0, Math.floor(random() * MATCH_LEVELS.length))
  );
  return { levelId: MATCH_LEVELS[index].id, pick: 'random' };
}
