import type { MatchEndAction } from '../winner-info/winner.component';
import { NewGameEntry, PlayKind, stepsOf } from '../menu/play-modes';
import type { GameMode } from '../state/game.states';
import type { MenuScreen } from './stage-screens';

/** What the mode last played is told from. */
export interface PlayKindState {
  /** True while a training mission is set as the match's level. */
  missionSet: boolean;
  /** The mode picked in a new game this visit, null before. */
  lastKind: PlayKind | null;
  /** True while the daily level is set up. */
  daily: boolean;
  /** True in a match of an endless run. */
  endless: boolean;
  mode: GameMode;
  freePlay: boolean;
}

/**
 * The mode last played: the training while one of its missions is set,
 * else the one picked in a new game, else the daily level or an endless
 * run while one is on, else who plays and whether the ladder applies.
 * The training is played a mission at a time: picked once, it is no mode
 * the campaign's Continue would come back to.
 */
export function playKindOf(state: PlayKindState): PlayKind {
  if (state.missionSet) {
    return 'training';
  }
  if (state.lastKind !== null && state.lastKind !== 'training') {
    return state.lastKind;
  }
  if (state.daily) {
    return 'daily';
  }
  if (state.endless) {
    return 'endless';
  }
  if (state.mode === 'two-players') {
    return 'two-players';
  }
  return state.freePlay ? 'free' : 'campaign';
}

/**
 * Where "Levels" on the result screen opens a new game: on the mode's
 * levels - the daily level and an endless run have none to choose, so on
 * their mode, to pick another.
 */
export function levelsEntry(kind: PlayKind): NewGameEntry {
  return { kind, step: stepsOf(kind).includes('level') ? 'level' : 'mode' };
}

/** The menu screen a way on from the result screen backs out to. */
export function screenAfterMatch(action: MatchEndAction): MenuScreen {
  switch (action) {
    case 'levels':
      return 'new-game';
    case 'evolve':
      return 'evolution';
    case 'watch':
      return 'replay';
    default:
      return 'menu';
  }
}
