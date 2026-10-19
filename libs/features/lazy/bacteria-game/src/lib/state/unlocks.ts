import { AchievementId } from './achievement-ids';
import { getAchievement } from './achievements';
import { goldOn, newlyUnlocked } from './campaign';
import { COLONY_COLORS } from './colony-colors';
import { getLevel, levelTitle, LEVELS } from './levels';
import { MEDAL_NAMES } from './medallions';
import { Progress } from './progress';
import { Rank, RANKS } from './ranks';
import { xpOf } from './xp';

/**
 * The cosmetics a player earns: colony colours and the arenas of the
 * levels. They follow from the progress - nothing about them is stored -
 * and never make a colony stronger. Orange and blue are free from the
 * start, every level's own arena too.
 */

/** Why each locked cosmetic is locked, by id; the open ones are absent. */
export type Locks = Readonly<Record<string, string>>;

/** What opens a colour, and the test of it. */
interface ColorUnlock {
  condition: string;
  open(progress: Progress): boolean;
}

const achieved = (id: AchievementId): ColorUnlock => ({
  condition: `Earn ${getAchievement(id).name}`,
  open: (progress) => progress.achievements[id] != null,
});

const reached = (rank: Rank): ColorUnlock => ({
  condition: `Reach the rank ${rank.name}`,
  open: (progress) => xpOf(progress) >= rank.xp,
});

const rankNamed = (name: string): Rank => {
  const rank = RANKS.find((r) => r.name === name);
  if (rank == null) {
    throw new Error(`No rank ${name}`);
  }
  return rank;
};

/** The colours that have to be earned, by colour id. */
const COLOR_UNLOCKS: Readonly<Record<string, ColorUnlock>> = {
  green: achieved('first-blood'),
  yellow: {
    condition: `Earn a ${MEDAL_NAMES.gold.toLowerCase()} medallion`,
    open: (progress) => LEVELS.some(({ id }) => goldOn(progress, id)),
  },
  cyan: achieved('pacifist'),
  pink: reached(rankNamed('Bacillus')),
  purple: reached(rankNamed('Biofilm')),
  red: achieved('hard-boiled'),
};

/** Why each locked colour is locked - "Earn Pacifist" - by colour id. */
export function colorLocks(progress: Progress): Locks {
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
export function arenaLocks(progress: Progress): Locks {
  const locks: Record<string, string> = {};
  for (const level of LEVELS) {
    if (!goldOn(progress, level.id)) {
      locks[level.id] = `${MEDAL_NAMES.gold} on ${levelTitle(level)}`;
    }
  }
  return locks;
}

/** The arena a choice draws in: the chosen one once earned, else none. */
export function activeArena(
  chosen: string | null,
  locks: Locks
): string | null {
  return chosen !== null && !(chosen in locks) ? chosen : null;
}

/**
 * The cosmetics a change of the locks opened, named for the result screen
 * - "Green colonies", "Hourglass arena".
 */
export function newCosmetics(
  before: { colors: Locks; arenas: Locks },
  after: { colors: Locks; arenas: Locks }
): string[] {
  return [
    ...COLONY_COLORS.filter(
      ({ id }) => id in before.colors && !(id in after.colors)
    ).map(({ name }) => `${name} colonies`),
    ...newlyUnlocked(before.arenas, after.arenas).map(
      (id) => `${levelTitle(getLevel(id))} arena`
    ),
  ];
}
