/** The achievements' ids, in the order the profile lists them - stable, they are stored. */
export const ACHIEVEMENT_IDS = [
  'first-blood',
  'pacifist',
  'blitz',
  'comeback',
  'siege',
  'clean-sweep',
  'full-dish',
  'gatekeeper',
  'converter',
  'flawless',
  'petri-scholar',
  'hard-boiled',
  'couch-war',
] as const;

export type AchievementId = (typeof ACHIEVEMENT_IDS)[number];

/** True for the id of an achievement the game has. */
export function isAchievementId(id: unknown): id is AchievementId {
  return (ACHIEVEMENT_IDS as readonly unknown[]).includes(id);
}
