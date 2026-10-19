import { AchievementId } from './achievement-ids';
import { BotDifficulty } from './bot-controller';
import { Player } from './player.model';

/**
 * The medallions a level can hold, from the easiest to the rarest. They are
 * nested: a gold medallion means the match also earned silver and bronze.
 */
export type MedalTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export const MEDAL_TIERS: readonly MedalTier[] = [
  'bronze',
  'silver',
  'gold',
  'platinum',
];

/** The tiers as a cabinet shows them, the rarest first. */
export const MEDAL_TIERS_RAREST_FIRST: readonly MedalTier[] = [
  ...MEDAL_TIERS,
].reverse();

export const MEDAL_NAMES: Record<MedalTier, string> = {
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  platinum: 'Platinum',
};

/** How fast and how cleanly a level has to be won for each medallion. */
export interface MedalLimits {
  /** The longest win, in seconds of match time, that still earns silver. */
  silverSec: number;
  /** The longest win that still earns gold. */
  goldSec: number;
  /**
   * Gold also asks to lose fewer bacteria than this share of the colony at
   * its peak. Bacteria die and divide all match long, so on a busy level the
   * losses add up to more than the colony ever was: shares above 1 are fine.
   */
  goldLossShare: number;
}

/** Platinum asks never to fall below this share of the computer's size. */
const PLATINUM_SIZE_RATIO = 0.5;

/** What a match against the computer measured, for its medallion. */
export interface MatchRecord {
  levelId: string;
  difficulty: BotDifficulty;
  won: boolean;
  /** Seconds of match time - pauses do not count. */
  durationSec: number;
  /** Boosts the human fired. */
  boostsFired: number;
  /** Own bacteria lost over the match. */
  lost: number;
  /** The most bacteria the colony had at once. */
  peakCount: number;
  /** The lowest ratio of own to enemy bacteria during the match. */
  lowestSizeRatio: number;
  /** Enemy bacteria the human's colony captured. */
  captured: number;
  /** Bacteria the computer's colony lost - captured or crushed. */
  enemyLost: number;
  /** The colony at its peak, as a share of the level's colony capacity. */
  peakShare: number;
}

/** What a match against the computer earned, for the result screen. */
export interface MedalAward {
  record: MatchRecord;
  /** The medallion this match earned, null for a loss or a draw. */
  medal: MedalTier | null;
  /** The best medallion the level held at this difficulty before. */
  previousBest: MedalTier | null;
  /** What the next medallion needs, null after a platinum. */
  hint: string | null;
  /** The achievements the match earned. */
  achievements: readonly AchievementId[];
}

/**
 * What a finished match against the computer measured, from the human's
 * player as the match left it - null without a human in it.
 */
export function matchRecord(
  players: readonly Player[],
  match: {
    levelId: string;
    difficulty: BotDifficulty;
    durationSec: number;
    winner: Player | null;
    /** The most bacteria a colony may have on this level and grid. */
    capacity: number;
  }
): MatchRecord | null {
  const human = players.find((player) => !player.isBot);
  if (human == null) {
    return null;
  }
  const bot = players.find((player) => player.isBot);
  const { winner, capacity, ...setup } = match;
  return {
    ...setup,
    won: winner != null && !winner.isBot,
    boostsFired: human.boostsFired,
    lost: human.lost,
    peakCount: human.peakCount,
    lowestSizeRatio: human.lowestSizeRatio,
    captured: human.captured,
    enemyLost: bot?.lost ?? 0,
    peakShare: capacity > 0 ? human.peakCount / capacity : 0,
  };
}

/**
 * Judges a match: the medallion it earned, and what kept it from the next
 * one as a line for the result screen - null once there is none to earn.
 */
export function judgeMatch(
  limits: MedalLimits,
  record: MatchRecord
): { medal: MedalTier | null; hint: string | null } {
  const medal = medalFor(limits, record);
  const next = MEDAL_TIERS[medalRank(medal)] ?? null;
  return {
    medal,
    hint:
      next == null
        ? null
        : `${MEDAL_NAMES[next]} needs ${missing(next, limits, record)}.`,
  };
}

/** The medallion a match earned, null for a match that was not won. */
export function medalFor(
  limits: MedalLimits,
  record: MatchRecord
): MedalTier | null {
  let earned: MedalTier | null = null;
  for (const tier of MEDAL_TIERS) {
    if (missing(tier, limits, record) != null) {
      break;
    }
    earned = tier;
  }
  return earned;
}

/**
 * What the next medallion after the one held asks for, before a match is
 * played - null once platinum is held.
 */
export function medalGoal(
  limits: MedalLimits,
  held: MedalTier | null
): string | null {
  switch (held) {
    case null:
      return 'Bronze needs a win.';
    case 'bronze':
      return `Silver needs a win within ${clock(limits.silverSec)}.`;
    case 'silver':
      return `Gold needs a win within ${clock(limits.goldSec)}, losing under ${percent(limits.goldLossShare)} of your peak colony.`;
    case 'gold':
      return `Platinum needs a gold win without a boost that never falls below ${percent(PLATINUM_SIZE_RATIO)} of the computer’s size.`;
    case 'platinum':
      return null;
  }
}

/** The better of two medallions, either of them possibly none. */
export function betterMedal(
  a: MedalTier | null,
  b: MedalTier | null
): MedalTier | null {
  return medalRank(a) >= medalRank(b) ? a : b;
}

/** 0 for no medallion, 1 for bronze up to 4 for platinum. */
export function medalRank(tier: MedalTier | null): number {
  return tier == null ? 0 : MEDAL_TIERS.indexOf(tier) + 1;
}

/**
 * What the match lacked for this one tier, its own condition only - the
 * tiers below are checked on their own. Null when nothing is missing.
 */
function missing(
  tier: MedalTier,
  limits: MedalLimits,
  record: MatchRecord
): string | null {
  switch (tier) {
    case 'bronze':
      return record.won ? null : 'a win';
    case 'silver':
      return slower(record.durationSec, limits.silverSec);
    case 'gold': {
      const lostShare =
        record.peakCount > 0 ? record.lost / record.peakCount : 0;
      return (
        slower(record.durationSec, limits.goldSec) ??
        (lostShare < limits.goldLossShare
          ? null
          : `a cleaner win - losses under ${percent(limits.goldLossShare)} of your peak colony, you had ${percent(lostShare)}`)
      );
    }
    case 'platinum':
      if (record.boostsFired > 0) {
        return 'a gold win without a boost';
      }
      return record.lowestSizeRatio >= PLATINUM_SIZE_RATIO
        ? null
        : `a gold win that never falls below ${percent(PLATINUM_SIZE_RATIO)} of the computer’s size`;
  }
}

/** How much faster the win has to be, null when it was fast enough. */
function slower(durationSec: number, limitSec: number): string | null {
  if (durationSec <= limitSec) {
    return null;
  }
  return `a win ${Math.ceil(durationSec - limitSec)} s faster`;
}

function percent(share: number): string {
  return `${Math.round(share * 100)} %`;
}

/** Seconds as the match clock shows them, "1:05". */
function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
