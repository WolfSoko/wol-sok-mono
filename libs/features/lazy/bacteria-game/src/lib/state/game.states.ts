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
import {
  BotDifficulty,
  DEFAULT_COLORS,
  DEFAULT_DIFFICULTY,
  DEFAULT_MODE,
  type EndlessRun,
  EndReason,
  GameMode,
  getLevel,
  HeadStart,
  LEVELS,
  MatchEarnings,
  Player,
  type RankedRun,
  type Replay,
  seatFirst,
  Series,
  SeriesLength,
  timeLeft,
  winRuleOf,
} from '@wolsok/feat-shared-bacteria-engine';
import { matchRules, nextMatchOf, OneMatch, SETUP_MATCH } from './match-rules';

export { DEFAULT_MODE, isGameMode } from '@wolsok/feat-shared-bacteria-engine';
export type { GameMode } from '@wolsok/feat-shared-bacteria-engine';

/**
 * An online match as this device takes part in it: its seat - 0 for the
 * host - and the setup the host picked for the next match.
 */
export interface OnlineSeat {
  seat: 0 | 1;
  levelId: string;
  /** The colour ids of the host's (left) and the guest's (right) colony. */
  colors: [string, string];
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
  /**
   * What ended the match that is over - also set for a draw, where
   * `winner` stays null - and null while no match is over.
   */
  endedBy: EndReason | null;
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
  /** A run someone shared in a link, offered as a ghost to fight. */
  challenge: Replay | null;
  /**
   * What the next match is set to outside the setup - a ghost, a training
   * mission, the daily level, the endless run's match, with its ranked
   * start (ADR 0012) - see `matchRules`. It holds for that one match; a
   * reset sets it back to `setup`.
   */
  next: OneMatch;
  /** The endless run under way, null outside one - it outlasts a match. */
  endless: EndlessRun | null;
  /** The ranked endless run under way - null for an unranked one. */
  endlessRanked: RankedRun | null;
  /** The online match this device is connected to, null outside one. */
  online: OnlineSeat | null;
  /** True while an online match waits for the other device's inputs. */
  waitingForPeer: boolean;
}

export function createInitialState(): GameStateState {
  return {
    currentState: GameState.START,
    timePassed: 1,
    fps: 0,
    width: 480,
    height: 320,
    winner: null,
    endedBy: null,
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
    challenge: null,
    next: SETUP_MATCH,
    endless: null,
    endlessRanked: null,
    online: null,
    waitingForPeer: false,
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
  withComputed(
    ({
      currentState,
      levelId,
      timePassed,
      next,
      mode,
      seriesLength,
      endedBy,
      online,
      colors,
    }) => {
      const nextMatch = computed(() => nextMatchOf(next(), online()));
      const rules = computed(() =>
        matchRules(nextMatch(), {
          levelId: levelId(),
          mode: mode(),
          seriesLength: seriesLength(),
        })
      );
      const level = computed(() => getLevel(rules().levelId));
      const winRule = computed(() => winRuleOf(level()));
      const gameSeconds = computed(() => Math.floor(timePassed() / 1000));
      return {
        /** What the next match is: online, set outside the setup, or the setup's. */
        nextMatch,
        /** How the next match is played and what it counts for. */
        matchRules: rules,
        /** The level of the next match: one picked for it, or the selected one. */
        level,
        /** How the next match is won. */
        winRule,
        /** True while a match is on, paused or not. */
        isMatchOn: computed(() => isMatchOn(currentState())),
        /** True while the match is paused. */
        isPaused: computed(() => currentState() === GameState.PAUSED),
        /** Whole seconds of the match played, as the match clock shows them. */
        gameSeconds,
        /**
         * Whole seconds a timed level has left, as its clock counts them
         * down - null on a level without a time limit. The match ends on
         * the tick its limit is reached, when this turns 0.
         */
        secondsLeft: computed(() => timeLeft(winRule(), gameSeconds())),
        /** True once a match is over - also for a draw. */
        matchEnded: computed(() => endedBy() !== null),
        /**
         * The colours of the player at this device and of their opponent,
         * for the menus: the setup's left and right colour, and online the
         * pair of the match from this device's seat - the guest plays the
         * right colony.
         */
        playerColors: computed((): [string, string] => {
          const seat = online();
          return seat === null ? colors() : seatFirst(seat.colors, seat.seat);
        }),
      };
    }
  ),
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
