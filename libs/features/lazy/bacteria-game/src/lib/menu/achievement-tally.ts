import { ACHIEVEMENTS, Progress } from '@wolsok/feat-shared-bacteria-engine';

/** How far the player got with the achievements. */
export interface AchievementTally {
  /** The achievements earned. */
  readonly earned: number;
  /** The achievements the game has. */
  readonly total: number;
  /** The share earned, in whole percent. */
  readonly percent: number;
}

/** Counts the achievements earned of those the game has, ignoring unknown ids. */
export function achievementTally(
  achievements: Progress['achievements']
): AchievementTally {
  const total = ACHIEVEMENTS.length;
  const earned = ACHIEVEMENTS.filter(
    ({ id }) => achievements[id] != null
  ).length;
  return { earned, total, percent: Math.round((100 * earned) / total) };
}
