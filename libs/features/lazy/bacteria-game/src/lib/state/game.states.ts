import { computed, Injector, untracked } from '@angular/core';
import {
  getState,
  patchState,
  PartialStateUpdater,
  signalStore,
  StateSource,
  watchState,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { Observable } from 'rxjs';
import { BotDifficulty, DEFAULT_DIFFICULTY } from './bot-controller';
import { DEFAULT_COLORS } from './colony-colors';
import { getLevel, LEVELS } from './levels';
import { MatchEarnings } from './earnings';
import { HeadStart, Series, SeriesLength } from './rivalry';
import { Player } from './player.model';

/** Who steers the second crosshair. */
export type GameMode = 'two-players' | 'vs-computer';

/**
 * The mode a fresh game starts in. Against the computer, because that is what
 * a single person opening the game can play right away.
 */
export const DEFAULT_MODE: GameMode = 'vs-computer';

export function isGameMode(value: unknown): value is GameMode {
  return value === 'vs-computer' || value === 'two-players';
}

export enum GameState {
  RUNNING,
  PAUSED,
  END,
  START,
}

/** True while a match is on - a paused match is still a match. */
export function isMatchOn(state: GameState): boolean {
  return state === GameState.RUNNING || state === GameState.PAUSED;
}

export interface GameStateState {
  currentState: GameState;
  /** Milliseconds of the match played - whole ticks, see `TICK_MS`. */
  timePassed: number;
  fps: number;
  width: number;
  height: number;
  winner: Player | null;
  /** True once a match is over - also for a draw, where `winner` stays null. */
  matchEnded: boolean;
  /**
   * What the match that just ended earned - null until a match is over, and
   * after one against the computer without a human in it.
   */
  earnings: MatchEarnings | null;
  keysPressed: string[];
  /** Id of the level that is selected - decides the map and the balance. */
  levelId: string;
  /** Two humans on one screen, or one human against the computer. */
  mode: GameMode;
  /** How hard the computer plays in `vs-computer` mode. */
  difficulty: BotDifficulty;
  /** The colour ids of the left and the right colony. */
  colors: [string, string];
  /** Between two players: how many matches a series is the best of. */
  seriesLength: SeriesLength;
  /** Between two players: who starts bigger. */
  headStart: HeadStart;
  /** The series two players have under way, null outside one. */
  series: Series | null;
}

export function createInitialState(): GameStateState {
  return {
    currentState: GameState.START,
    timePassed: 1,
    fps: 0,
    width: 480,
    height: 320,
    winner: null,
    matchEnded: false,
    earnings: null,
    keysPressed: [],
    levelId: LEVELS[0].id,
    mode: DEFAULT_MODE,
    difficulty: DEFAULT_DIFFICULTY,
    colors: [DEFAULT_COLORS[0], DEFAULT_COLORS[1]],
    seriesLength: 1,
    headStart: 0,
    series: null,
  };
}

/**
 * The state of the game page: the match under way and the setup of the next
 * one. Only {@link GameStateService} and the settings change it; everything
 * else reads its signals.
 */
export const GameStateStore = signalStore(
  { providedIn: 'root' },
  withState(createInitialState),
  withComputed(({ currentState, levelId, timePassed }) => ({
    /** The level that is selected, resolved from the stored id. */
    level: computed(() => getLevel(levelId())),
    /** True while a match is on, paused or not. */
    isMatchOn: computed(() => isMatchOn(currentState())),
    /** True while the match is running - not paused, not over. */
    isRunning: computed(() => currentState() === GameState.RUNNING),
    /** True while the match is paused. */
    isPaused: computed(() => currentState() === GameState.PAUSED),
    /** Whole seconds of the match played, as the match clock shows them. */
    gameSeconds: computed(() => Math.floor(timePassed() / 1000)),
  })),
  withMethods((store) => ({
    /** Changes the state - several updaters land as one change. */
    update(
      ...updaters: (
        | Partial<GameStateState>
        | PartialStateUpdater<GameStateState>
      )[]
    ): void {
      patchState(store, ...updaters);
    },
    /** The state as it stands, without tracking it in a reactive context. */
    snapshot(): GameStateState {
      return untracked(() => getState(store));
    },
  }))
);
export type GameStateStore = InstanceType<typeof GameStateStore>;

/**
 * Every state of a store from the subscription on - the current one first,
 * then each change synchronously, inside the update that made it. Unlike
 * `toObservable`, nothing waits for change detection, so a subscriber sees
 * every state on the way, as the game loop and the settings need.
 */
export function stateChanges<State extends object>(
  store: StateSource<State>,
  injector: Injector
): Observable<State> {
  return new Observable<State>((subscriber) => {
    const watcher = watchState(store, (state) => subscriber.next(state), {
      injector,
    });
    return () => watcher.destroy();
  });
}
