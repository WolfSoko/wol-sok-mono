import { clock, TICKS_PER_SEC } from './fixed-tick';
import { Player } from './player.model';

/**
 * How a level is won. Plain data, so a level table, a replay header or a
 * link can carry it:
 *
 * - `annihilation`: the last colony left wins - every level until now.
 * - `timed`: the same, but once `limitSec` - whole seconds - of match time
 *   have passed the biggest colony wins - a losing match ends as well.
 * - `survive`: the same, but the left colony - up against a boss - wins
 *   once it is still alive after `limitSec`.
 * - `hold`: the same, but a colony also wins once it has held the map's
 *   hold zone for `holdSec` in all - held while it has more bacteria on it
 *   than any other colony.
 *
 * A replay takes the rule from its level, so a change to a level's rule
 * raises `BALANCE_VERSION`, as a change to its balance does.
 */
export type WinRule =
  | { kind: 'annihilation' }
  | { kind: 'timed'; limitSec: number }
  | { kind: 'survive'; limitSec: number }
  | { kind: 'hold'; holdSec: number };

/** What ended a match. */
export type EndReason = 'annihilation' | 'time' | 'hold' | 'survive';

/** How a match ended: the winner, or null for a draw - and what ended it. */
export interface MatchOutcome {
  winner: Player | null;
  reason: EndReason;
}

export const ANNIHILATION: WinRule = { kind: 'annihilation' };

/** The rule of a level or a match - annihilation where none is set. */
export function winRuleOf({ win }: { win?: WinRule }): WinRule {
  return win ?? ANNIHILATION;
}

/**
 * Decides whether the match is over, after `elapsedSec` of match time.
 *
 * Returns `null` while it is still running, otherwise the outcome. Both
 * colonies can wipe each other out in the same step, which is a draw and
 * still has to end the match - hence the outcome wrapper instead of a bare
 * winner, which cannot tell "draw" from "not finished".
 */
export function judgeOutcome(
  rule: WinRule,
  players: readonly Player[],
  elapsedSec: number
): MatchOutcome | null {
  if (players.length < 2) {
    return null;
  }
  // A wiped out colony ends the match whatever the rule.
  const wipedOut = annihilation(players);
  if (wipedOut !== null) {
    return wipedOut;
  }
  switch (rule.kind) {
    case 'annihilation':
      return null;
    case 'timed':
      return timeLeft(rule, elapsedSec) === 0
        ? {
            winner: soleLeader(players, (p) => p.bacteriaCount),
            reason: 'time',
          }
        : null;
    case 'survive':
      return timeLeft(rule, elapsedSec) === 0
        ? { winner: players[0], reason: 'survive' }
        : null;
    case 'hold': {
      const target = rule.holdSec * TICKS_PER_SEC;
      for (const player of players) {
        if (player.holdTicks >= target) {
          return { winner: player, reason: 'hold' };
        }
      }
      return null;
    }
  }
}

/** Seconds of match time left, null for a rule without a limit. */
export function timeLeft(rule: WinRule, elapsedSec: number): number | null {
  return rule.kind === 'timed' || rule.kind === 'survive'
    ? Math.max(0, rule.limitSec - elapsedSec)
    : null;
}

/**
 * The rule in a few words for the level choice - "Timed · 2:30" - null for
 * annihilation, which goes without saying.
 */
export function ruleNote(rule: WinRule): string | null {
  switch (rule.kind) {
    case 'annihilation':
      return null;
    case 'timed':
      return `Timed · ${clock(rule.limitSec)}`;
    case 'survive':
      return `Survive · ${clock(rule.limitSec)}`;
    case 'hold':
      return `Hold the zone · ${clock(rule.holdSec)}`;
  }
}

/** The seconds a colony must hold the zone, null for a rule without one. */
export function holdTarget(rule: WinRule): number | null {
  return rule.kind === 'hold' ? rule.holdSec : null;
}

/**
 * The colony that holds the zone this tick: the one with the most bacteria
 * on it - null while nobody is on it, or two have as many.
 */
export function zoneHolder(
  colonies: readonly { playerId: number; onHill: number }[]
): number | null {
  const holder = soleLeader(colonies, ({ onHill }) => onHill);
  return holder !== null && holder.onHill > 0 ? holder.playerId : null;
}

/** The one item with the highest value - null when two share it. */
function soleLeader<T>(
  items: readonly T[],
  value: (item: T) => number
): T | null {
  let leader: T | null = null;
  let most = -Infinity;
  for (const item of items) {
    const v = value(item);
    if (v > most) {
      leader = item;
      most = v;
    } else if (v === most) {
      leader = null;
    }
  }
  return leader;
}

/** The last colony left wins; both gone at once is a draw. */
function annihilation(players: readonly Player[]): MatchOutcome | null {
  const survivors = players.filter((player) => player.bacteriaCount > 0);
  if (survivors.length === 1) {
    return { winner: survivors[0], reason: 'annihilation' };
  }
  // Only a match that saw losses can be a draw - at kick off nobody has
  // bacteria yet either, and that is not an outcome.
  const fought = players.some((player) => player.lost > 0);
  return survivors.length === 0 && fought
    ? { winner: null, reason: 'annihilation' }
    : null;
}
