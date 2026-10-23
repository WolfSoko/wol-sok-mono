import type { game as gameTexts } from '../i18n/en/game';

/** The id of a rank, as the dictionaries list it. */
export type RankId = keyof typeof gameTexts.ranks;

/**
 * The ranks XP climbs, named after microbiology, from a dormant spore to a
 * bacterium nothing can stop. A rank itself is only shown, but the XP
 * behind it does unlock gameplay: it earns the DNA the colony evolves with
 * (`dnaEarned` in evolution.ts, ADR 0013), priced so that everything is
 * bred about when the top rank is reached.
 */
export interface Rank {
  /** The rank's id in the dictionaries. */
  id: RankId;
  name: string;
  /** The XP the rank starts at. */
  xp: number;
}

export const RANKS: readonly Rank[] = [
  { id: 'spore', name: 'Spore', xp: 0 },
  { id: 'coccus', name: 'Coccus', xp: 250 },
  { id: 'bacillus', name: 'Bacillus', xp: 750 },
  { id: 'spirillum', name: 'Spirillum', xp: 1500 },
  { id: 'biofilm', name: 'Biofilm', xp: 3000 },
  { id: 'colony', name: 'Colony', xp: 5000 },
  { id: 'culture', name: 'Culture', xp: 8000 },
  { id: 'superbug', name: 'Superbug', xp: 12000 },
];

/** Where an XP count stands: its rank, and the way to the next one. */
export interface RankStanding {
  rank: Rank;
  /** 1 for the first rank. */
  number: number;
  /** The rank after this one, null at the top. */
  next: Rank | null;
  /** How far towards the next rank, 0 to 1 - 1 at the top. */
  progress: number;
  /** The XP still missing for the next rank, null at the top. */
  toNext: number | null;
}

/** The rank an XP count has reached, and how far it is to the next one. */
export function rankFor(xp: number): RankStanding {
  const index = RANKS.findLastIndex((rank) => xp >= rank.xp);
  const rank = RANKS[Math.max(0, index)];
  const next = RANKS[index + 1] ?? null;
  return {
    rank,
    number: Math.max(0, index) + 1,
    next,
    progress:
      next === null
        ? 1
        : Math.min(1, Math.max(0, (xp - rank.xp) / (next.xp - rank.xp))),
    toNext: next === null ? null : next.xp - xp,
  };
}

/**
 * Where a match's XP leaves the player, for the bar that shows it: the rank
 * reached, whether it is a new one, and how much of the bar was held before
 * and how much the match added - all of it new after a rank up.
 */
export interface XpClimb {
  standing: RankStanding;
  rankUp: boolean;
  /** Per cent of the bar held before the match. */
  held: number;
  /** Per cent of the bar the match added. */
  gained: number;
}

export function xpClimb(before: number, gain: number): XpClimb {
  const from = rankFor(before);
  const standing = rankFor(before + gain);
  const rankUp = standing.number > from.number;
  const held = rankUp ? 0 : from.progress;
  return {
    standing,
    rankUp,
    held: 100 * held,
    gained: 100 * (standing.progress - held),
  };
}
