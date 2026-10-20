import { clock } from './fixed-tick';
import { Player } from './player.model';

/**
 * How a level is won. Plain data, so a level table, a replay header or a
 * link can carry it:
 *
 * - `annihilation`: the last colony left wins - every level until now.
 * - `timed`: the same, but once `limitSec` of match time have passed the
 *   biggest colony wins - a losing match ends as well.
 */
export type WinRule =
  | { kind: 'annihilation' }
  | { kind: 'timed'; limitSec: number };

/** What ended a match. */
export type EndReason = 'annihilation' | 'time';

/** How a match ended: the winner, or null for a draw - and what ended it. */
export interface MatchOutcome {
  winner: Player | null;
  reason: EndReason;
}

export const ANNIHILATION: WinRule = { kind: 'annihilation' };

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
  const wipedOut = annihilation(players);
  if (wipedOut !== null || rule.kind === 'annihilation') {
    return wipedOut;
  }
  return elapsedSec >= rule.limitSec ? biggest(players) : null;
}

/** Seconds of match time left, null for a rule without a limit. */
export function timeLeft(rule: WinRule, elapsedSec: number): number | null {
  return rule.kind === 'timed' ? Math.max(0, rule.limitSec - elapsedSec) : null;
}

/**
 * The rule in a few words for the level choice - "Timed · 2:30" - null for
 * annihilation, which goes without saying.
 */
export function ruleNote(rule: WinRule | undefined): string | null {
  if (rule?.kind !== 'timed') {
    return null;
  }
  return `Timed · ${clock(rule.limitSec)}`;
}

/** The last colony left wins; both gone at once is a draw. */
function annihilation(players: readonly Player[]): MatchOutcome | null {
  if (players.length < 2) {
    return null;
  }
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
