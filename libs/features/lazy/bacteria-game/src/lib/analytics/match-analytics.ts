import { Injectable } from '@angular/core';
import type { MatchEarnings } from '../state/earnings';
import type { GameStateState } from '../state/game.states';
import { getLevel } from '../state/levels';
import { isNewBest } from '../state/medallions';
import type { MatchPlan } from '../state/match-setup';
import type { Player } from '../state/player.model';
import { xpClimb } from '../state/ranks';
import type { Simulation } from '../state/simulation';
import type { MatchOutcome } from '../state/win-conditions';
import {
  GameEvents,
  injectGameAnalytics,
  MatchKind,
  MatchOutcomeName,
  MatchParams,
} from './game-analytics';

/** What of the game's state tells how a match is played. */
export type MatchState = Pick<
  GameStateState,
  | 'online'
  | 'ghost'
  | 'dailyDay'
  | 'endlessMatch'
  | 'ranked'
  | 'endlessRanked'
  | 'timePassed'
>;

/**
 * The match statistics: when a match starts, ends and is left before it
 * ended. `GameStateService` tells it those three moments; what a match was,
 * how it went and what it earned is worked out here.
 */
@Injectable({ providedIn: 'root' })
export class MatchAnalytics {
  private readonly analytics = injectGameAnalytics();
  /** The match under way, null between matches. */
  private running: MatchParams | null = null;

  /**
   * A match starts - a restart from the pause menu too, which leaves the
   * one under way after the `timePassed` the state still holds of it.
   */
  public started(
    plan: MatchPlan,
    state: MatchState,
    simulation: Pick<Simulation, 'kind' | 'ruleset'>
  ): void {
    this.left(state.timePassed);
    this.running = matchParams(plan, state, simulation);
    this.analytics.track('level_start', this.running);
  }

  /** The match ended with its outcome, after the state's `timePassed` ms. */
  public ended(
    outcome: MatchOutcome,
    state: MatchState,
    earnings: MatchEarnings | null
  ): void {
    const match = this.takeRunning();
    if (match === null) return;
    const result = outcomeName(outcome.winner, match.kind, state);
    this.analytics.track('level_end', {
      ...match,
      ...earned(earnings),
      success: result === 'win',
      outcome: result,
      reason: outcome.reason,
      duration_sec: seconds(state.timePassed),
    });
    for (const achievement_id of earnings?.achievements ?? []) {
      this.analytics.track('unlock_achievement', { achievement_id });
    }
    const rankUp = newRank(earnings);
    if (rankUp !== null) {
      this.analytics.track('level_up', rankUp);
    }
  }

  /** The match's recording reached the cloud (or this device's list). */
  public replaySaved(online: boolean, ranked: boolean): void {
    this.analytics.track('replay_saved', { online, ranked });
  }

  /**
   * The game was reset or restarted after `timePassed` ms: a match still
   * under way was left before it ended.
   */
  public left(timePassed: number): void {
    const match = this.takeRunning();
    if (match === null) return;
    this.analytics.track('match_abandoned', {
      ...match,
      duration_sec: seconds(timePassed),
    });
  }

  private takeRunning(): MatchParams | null {
    const match = this.running;
    this.running = null;
    return match;
  }
}

export function matchParams(
  plan: MatchPlan,
  state: MatchState,
  simulation: Pick<Simulation, 'kind' | 'ruleset'>
): MatchParams {
  const kind = matchKind(plan, state);
  return {
    level_name: plan.levelId,
    kind,
    difficulty:
      plan.mode === 'vs-computer' && kind !== 'online'
        ? plan.difficulty
        : 'none',
    ranked:
      state.ranked !== null || (state.endlessMatch && !!state.endlessRanked),
    simulation: simulation.kind,
    ruleset: simulation.ruleset ?? 'float',
  };
}

/**
 * The mode of a match. Free play is no mode of its own: the user property
 * `free_play` tells it from the campaign's ladder.
 */
export function matchKind(plan: MatchPlan, state: MatchState): MatchKind {
  if (state.online !== null) return 'online';
  if (state.ghost !== null) return 'ghost';
  if (getLevel(plan.levelId).mission !== undefined) return 'training';
  if (state.dailyDay !== null) return 'daily';
  if (state.endlessMatch) return 'endless';
  return plan.mode === 'two-players' ? 'two_players' : 'vs_computer';
}

/** How the match ended for the player at this device. */
export function outcomeName(
  winner: Player | null,
  kind: MatchKind,
  state: Pick<MatchState, 'online'>
): MatchOutcomeName {
  if (winner === null) return 'draw';
  if (kind === 'two_players') return 'decided';
  const won =
    state.online !== null ? winner.id === state.online.seat : !winner.isBot;
  return won ? 'win' : 'loss';
}

function earned(earnings: MatchEarnings | null) {
  const award = earnings?.award ?? null;
  const mission = earnings?.training;
  return {
    medal: award?.medal ?? 'none',
    new_best: award !== null && isNewBest(award),
    achievements: earnings?.achievements.length ?? 0,
    levels_unlocked: earnings?.unlocked.length ?? 0,
    xp: earnings?.xp.total ?? 0,
    mission_done:
      mission === undefined ? undefined : mission.shortfall === null,
  };
}

/** The rank the match's XP climbed to, null without a new one. */
function newRank(
  earnings: MatchEarnings | null
): GameEvents['level_up'] | null {
  if (!earnings || earnings.xpBefore === null) return null;
  const { rankUp, standing } = xpClimb(earnings.xpBefore, earnings.xp.total);
  return rankUp
    ? { level: standing.number, character: standing.rank.id }
    : null;
}

/** Whole seconds, as the match clock shows them. */
function seconds(ms: number): number {
  return Math.floor(ms / 1000);
}
