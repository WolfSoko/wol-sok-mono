import { english, GameText } from '../i18n/game-text';
import { AchievementId } from './achievement-ids';
import { achievementTexts } from './achievements';
import { goldOn, newlyUnlocked } from './campaign';
import { COLONY_COLORS, colonyColorText } from './colony-colors';
import { getLevel, levelTitleText, LEVELS } from './levels';
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
  condition: GameText;
  open(progress: Progress): boolean;
}

const achieved = (id: AchievementId): ColorUnlock => ({
  condition: {
    key: 'game.unlocks.earnAchievement',
    params: { achievement: achievementTexts(id).name },
  },
  open: (progress) => progress.achievements[id] != null,
});

const reached = (rank: Rank): ColorUnlock => ({
  condition: {
    key: 'game.unlocks.reachRank',
    params: { rank: { key: `game.ranks.${rank.id}` } },
  },
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
    condition: { key: 'game.unlocks.earnGold' },
    open: (progress) => LEVELS.some(({ id }) => goldOn(progress, id)),
  },
  cyan: achieved('pacifist'),
  pink: reached(rankNamed('Bacillus')),
  purple: reached(rankNamed('Biofilm')),
  red: achieved('hard-boiled'),
};

/** Why each locked colour is locked - "Earn Pacifist" - by colour id. */
export function colorLocks(progress: Progress): Locks {
  return englishLocks(colorLockTexts(progress));
}

/** {@link colorLocks} as texts to translate. */
export function colorLockTexts(
  progress: Progress
): Readonly<Record<string, GameText>> {
  const locks: Record<string, GameText> = {};
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
  return englishLocks(arenaLockTexts(progress));
}

/** {@link arenaLocks} as texts to translate. */
export function arenaLockTexts(
  progress: Progress
): Readonly<Record<string, GameText>> {
  const locks: Record<string, GameText> = {};
  for (const level of LEVELS) {
    if (!goldOn(progress, level.id)) {
      locks[level.id] = arenaLockText(level.id);
    }
  }
  return locks;
}

/** Why a level's arena is locked, while it is: "Gold on Hourglass". */
export function arenaLockText(levelId: string): GameText {
  return {
    key: 'game.unlocks.goldOn',
    params: { title: levelTitleText(getLevel(levelId)) },
  };
}

/**
 * What opens a colour - "Earn Pacifist" - null for a colour that is free
 * from the start.
 */
export function colorLockText(colorId: string): GameText | null {
  return COLOR_UNLOCKS[colorId]?.condition ?? null;
}

function englishLocks(texts: Readonly<Record<string, GameText>>): Locks {
  return Object.fromEntries(
    Object.entries(texts).map(([id, text]) => [id, english(text)])
  );
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
  return newCosmeticTexts(before, after).map(english);
}

/** {@link newCosmetics} as texts to translate. */
export function newCosmeticTexts(
  before: { colors: Locks; arenas: Locks },
  after: { colors: Locks; arenas: Locks }
): GameText[] {
  return [
    ...COLONY_COLORS.filter(
      ({ id }) => id in before.colors && !(id in after.colors)
    ).map(({ id }): GameText => ({
      key: 'game.unlocks.colonies',
      params: { color: colonyColorText(id) },
    })),
    ...newlyUnlocked(before.arenas, after.arenas).map((id): GameText => ({
      key: 'game.unlocks.arena',
      params: { title: levelTitleText(getLevel(id)) },
    })),
  ];
}
