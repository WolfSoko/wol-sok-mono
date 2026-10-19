import { AchievementId } from './achievement-ids';
import { getAchievement } from './achievements';
import { BOT_DIFFICULTIES } from './bot-controller';
import { COLONY_COLORS } from './colony-colors';
import { levelTitle, LEVELS } from './levels';
import { medalRank, MEDAL_NAMES } from './medallions';
import { bestMedal, medalTally, Progress } from './progress';
import { RANKS } from './ranks';
import { xpOf } from './xp';

/**
 * The cosmetics a player earns: colony colours and the arenas of the
 * levels. They follow from the progress - nothing about them is stored -
 * and never make a colony stronger. Orange and blue are free from the
 * start, every level's own arena too.
 */

/** What opens a colour, and the test of it. */
interface ColorUnlock {
  condition: string;
  open(progress: Progress): boolean;
}

const achieved = (id: AchievementId): ColorUnlock => ({
  condition: `Earn ${getAchievement(id).name}`,
  open: (progress) => progress.achievements[id] != null,
});

const rank = (name: string): ColorUnlock => {
  const xp = RANKS.find((r) => r.name === name)?.xp ?? 0;
  return {
    condition: `Reach the rank ${name}`,
    open: (progress) => xpOf(progress) >= xp,
  };
};

/** The colours that have to be earned, by colour id. */
const COLOR_UNLOCKS: Readonly<Record<string, ColorUnlock>> = {
  green: achieved('first-blood'),
  yellow: {
    condition: 'Earn a gold medallion',
    open: (progress) => {
      const tally = medalTally(progress.medals);
      return tally.gold + tally.platinum > 0;
    },
  },
  cyan: achieved('pacifist'),
  pink: rank('Bacillus'),
  purple: rank('Biofilm'),
  red: achieved('hard-boiled'),
};

/** Why each locked colour is locked - "Earn Pacifist" - by colour id. */
export function colorLocks(
  progress: Progress
): Readonly<Record<string, string>> {
  const locks: Record<string, string> = {};
  for (const { id } of COLONY_COLORS) {
    const unlock = COLOR_UNLOCKS[id];
    if (unlock != null && !unlock.open(progress)) {
      locks[id] = unlock.condition;
    }
  }
  return locks;
}

/**
 * Why each locked arena is locked - "Gold on Hourglass" - by the id of the
 * level it belongs to. A level's arena opens for every other level with a
 * gold medallion on it, at any difficulty.
 */
export function arenaLocks(
  progress: Progress
): Readonly<Record<string, string>> {
  const locks: Record<string, string> = {};
  for (const level of LEVELS) {
    const gold = BOT_DIFFICULTIES.some(
      ({ id }) =>
        medalRank(bestMedal(progress, level.id, id)) >= medalRank('gold')
    );
    if (!gold) {
      locks[level.id] = `${MEDAL_NAMES.gold} on ${levelTitle(level)}`;
    }
  }
  return locks;
}

/**
 * The cosmetics a change of the progress opened, named for the result
 * screen - "Green colonies", "Hourglass arena".
 */
export function newCosmetics(before: Progress, after: Progress): string[] {
  const colors = colorLocks(before);
  const nowColors = colorLocks(after);
  const arenas = arenaLocks(before);
  const nowArenas = arenaLocks(after);
  return [
    ...COLONY_COLORS.filter(({ id }) => id in colors && !(id in nowColors)).map(
      ({ name }) => `${name} colonies`
    ),
    ...LEVELS.filter(({ id }) => id in arenas && !(id in nowArenas)).map(
      (level) => `${levelTitle(level)} arena`
    ),
  ];
}
