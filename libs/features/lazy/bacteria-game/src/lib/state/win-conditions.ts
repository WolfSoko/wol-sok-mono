import { clock, TICKS_PER_SEC } from './fixed-tick';
import { Player } from './player.model';

/**
 * How a level is won. Plain data, so a level table, a replay header or a
 * link can carry it:
 *
 * - `annihilation`: the last colony left wins - every level until now.
 * - `timed`: the same, but once `limitSec` - whole seconds - of match time
 *   have passed the biggest colony wins - a losing match ends as well.
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
  | { kind: 'hold'; holdSec: number };

/** What ended a match. */
export type EndReason = 'annihilation' | 'time' | 'hold';

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
  const wipedOut = annihilation(players);
  switch (rule.kind) {
    case 'annihilation':
      return wipedOut;
    case 'timed':
      return (
        wipedOut ?? (timeLeft(rule, elapsedSec) === 0 ? biggest(players) : null)
      );
    case 'hold': {
      const holder = players.find(
        (player) => player.holdTicks >= rule.holdSec * TICKS_PER_SEC
      );
      return wipedOut ?? (holder ? { winner: holder, reason: 'hold' } : null);
    }
  }
}

/** Seconds of match time left, null for a rule without a limit. */
export function timeLeft(rule: WinRule, elapsedSec: number): number | null {
  return rule.kind === 'timed' ? Math.max(0, rule.limitSec - elapsedSec) : null;
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
  let holder: number | null = null;
  let most = 0;
  for (const { playerId, onHill } of colonies) {
    if (onHill > most) {
      holder = playerId;
      most = onHill;
    } else if (onHill === most) {
      holder = null;
    }
  }
  return holder;
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

/** The biggest colony wins; a tie at the top is a draw. */
function biggest(players: readonly Player[]): MatchOutcome {
  const most = Math.max(...players.map((player) => player.bacteriaCount));
  const leaders = players.filter((player) => player.bacteriaCount === most);
  return {
    winner: leaders.length === 1 ? leaders[0] : null,
    reason: 'time',
  };
}
