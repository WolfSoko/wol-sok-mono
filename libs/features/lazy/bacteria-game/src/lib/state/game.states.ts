import { computed, untracked } from '@angular/core';
import {
  getState,
  patchState,
  PartialStateUpdater,
  signalStore,
  watchState,
  withComputed,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { distinctUntilChanged, Observable } from 'rxjs';
import { BotDifficulty, DEFAULT_DIFFICULTY } from './bot-controller';
import { DEFAULT_COLORS } from './colony-colors';
import { getLevel, LEVELS } from './levels';
import { MatchEarnings } from './earnings';
import { HeadStart, Series, SeriesLength } from './rivalry';
import { Player } from './player.model';
import type { Replay } from './replay';

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
  /** The recording of the last match but a ghost match, null before one. */
  lastReplay: Replay | null;
  /**
   * The recording the opponent plays back in a ghost match - the player's
   * own earlier run, turned to the other side - null outside one. It holds
   * for the one match it was set for.
   */
  ghost: Replay | null;
  /** A run someone shared in a link, offered as a ghost to fight. */
  challenge: Replay | null;
  /**
   * A level picked for one match against the computer outside the setup -
   * the daily level - null otherwise. Like the ghost, it holds for that one
   * match.
   */
  matchLevel: string | null;
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
    lastReplay: null,
    ghost: null,
    challenge: null,
    matchLevel: null,
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
  withComputed(({ currentState, levelId, timePassed, ghost, matchLevel }) => ({
    /**
     * The level of the next match: the ghost's, one picked for the match,
     * or the selected one.
     */
    level: computed(() =>
      getLevel(ghost()?.header.levelId ?? matchLevel() ?? levelId())
    ),
    /** True while a match is on, paused or not. */
    isMatchOn: computed(() => isMatchOn(currentState())),
    /** True while the match is paused. */
    isPaused: computed(() => currentState() === GameState.PAUSED),
    /** Whole seconds of the match played, as the match clock shows them. */
    gameSeconds: computed(() => Math.floor(timePassed() / 1000)),
  })),
  withProps((store) => {
    const listeners = new Set<() => void>();
    // One watcher for the lifetime of the store: each watchState call adds a
    // destroy hook to the injector, so it must not be one per subscription.
    watchState(store, () => {
      // A copy: one subscribed during the loop has had its value already.
      for (const listener of Array.from(listeners)) {
        // Skips one that a listener before it unsubscribed.
        if (listeners.has(listener)) {
          listener();
        }
      }
    });
    return { _listeners: listeners };
  }),
  withMethods((store) => ({
    /** Changes the state. */
    update(
      change: Partial<GameStateState> | PartialStateUpdater<GameStateState>
    ): void {
      patchState(store, change);
    },
    /**
     * What `read` returns from the subscription on: now, then after every
     * change in which it differs - synchronously, inside the update that
     * made it, as the Akita `select` did. Unlike `toObservable`, nothing
     * waits for change detection, so the game loop stops inside the update
     * that ends the match. Each subscriber reads the state afresh, so one
     * that changes the state in turn never leaves another with an older one.
     */
    select$<T>(
      read: () => T,
      equal: (a: T, b: T) => boolean = Object.is
    ): Observable<T> {
      return new Observable<T>((subscriber) => {
        const emit = () => subscriber.next(untracked(read));
        // Listening first, so a change made on the first value still arrives.
        store._listeners.add(emit);
        emit();
        return () => store._listeners.delete(emit);
      }).pipe(distinctUntilChanged(equal));
    },
    /** The state as it stands, without tracking it in a reactive context. */
    snapshot(): GameStateState {
      return untracked(() => getState(store));
    },
  }))
);
export type GameStateStore = InstanceType<typeof GameStateStore>;
