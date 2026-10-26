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
import { DEFAULT_COLORS, seatFirst } from './colony-colors';
import { getLevel, LEVELS } from './levels';
import { MatchEarnings } from './earnings';
import { HeadStart, Series, SeriesLength } from './rivalry';
import { Player } from './player.model';
import type { Replay } from './replay';
import type { EndlessRun } from './endless';
import type { RankedOutcome, RankedRun } from './ranked-match';
import { EndReason, timeLeft, winRuleOf } from './win-conditions';
import { DEFAULT_MODE, GameMode } from './game-mode';

export { DEFAULT_MODE, isGameMode } from './game-mode';
export type { GameMode } from './game-mode';

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
   * a ghost's, the daily level - null otherwise. It holds for that one
   * match; a reset ends it.
   */
  matchLevel: string | null;
  /** The UTC day of the daily level the match is played as, null otherwise. */
  dailyDay: string | null;
  /** True when the match is the endless run's - it takes the run on. */
  endlessMatch: boolean;
  /** The endless run under way, null outside one - it outlasts a match. */
  endless: EndlessRun | null;
  /**
   * What the ranked start of the next daily or endless match came to (ADR
   * 0012): the attempt it was declared as - null when it plays unranked -
   * and what the result screen says of it. Null for any other match, and
   * for one played as practice. It holds for that one match; a reset ends
   * it.
   */
  ranked: RankedOutcome | null;
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
    ghost: null,
    challenge: null,
    matchLevel: null,
    dailyDay: null,
    endlessMatch: false,
    endless: null,
    ranked: null,
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
      matchLevel,
      mode,
      endedBy,
      online,
      colors,
      ranked,
    }) => {
      const level = computed(() =>
        getLevel(online()?.levelId ?? matchLevel() ?? levelId())
      );
      const winRule = computed(() => winRuleOf(level()));
      const gameSeconds = computed(() => Math.floor(timePassed() / 1000));
      return {
        /** The level of the next match: one picked for it, or the selected one. */
        level,
        /** How the next match is won. */
        winRule,
        /** How the next match is played: a level picked for it, vs the computer. */
        matchMode: computed((): GameMode =>
          matchLevel() === null ? mode() : 'vs-computer'
        ),
        /** True while a match is on, paused or not. */
        isMatchOn: computed(() => isMatchOn(currentState())),
        /** True while the match is paused. */
        isPaused: computed(() => currentState() === GameState.PAUSED),
        /**
         * The ranked attempt the next match was declared as - null for an
         * unranked one. A ranked match plays through: no pause, no restart.
         */
        rankedMatch: computed(() => ranked()?.match ?? null),
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
