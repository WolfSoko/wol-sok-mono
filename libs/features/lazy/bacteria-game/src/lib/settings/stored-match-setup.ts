import { untracked } from '@angular/core';
import {
  BotDifficulty,
  difficultyOption,
  isHeadStart,
  isLevelId,
  isSeriesLength,
  sameColors,
  seriesWinner,
  validColorPair,
} from '@wolsok/feat-shared-bacteria-engine';
import { filter, type Observable, pairwise, Subject } from 'rxjs';
import type { GameStateService, MatchSetup } from '../state/game-state.service';
import {
  GameState,
  type GameStateStore,
  isGameMode,
  isMatchOn,
} from '../state/game.states';

/** How each part of the match setup is read back from storage. */
const MATCH_SETUP: {
  readonly [K in keyof MatchSetup]: (
    stored: unknown
  ) => MatchSetup[K] | undefined;
} = {
  mode: (stored) => (isGameMode(stored) ? stored : undefined),
  difficulty: (stored) => {
    const id = (stored ?? null) as BotDifficulty | null;
    return difficultyOption(id)?.id;
  },
  levelId: (stored) => (isLevelId(stored) ? stored : undefined),
  colors: (stored) => validColorPair(stored) ?? undefined,
  seriesLength: (stored) => (isSeriesLength(stored) ? stored : undefined),
  headStart: (stored) => (isHeadStart(stored) ? stored : undefined),
};

/** The settings that set up a match - kept in the game state store. */
const MATCH_SETUP_KEYS = Object.keys(MATCH_SETUP) as (keyof MatchSetup)[];

/** The match setup as it is stored beside the device settings. */
export type StoredMatchSetupValues = Partial<MatchSetup>;

/** The parts of a stored setup that passed the checks of `MATCH_SETUP`. */
type ReadableMatchSetup = Partial<MatchSetup>;

/**
 * Restores the match setup the game state store keeps and gives it back to
 * store. A setup the player changed keeps the player's choice. A match or
 * series under way keeps its setup: the stored one waits for the menu, and
 * is what gets stored meanwhile.
 */
export class StoredMatchSetup {
  /** The parts of the setup the player changed - what restoring must keep. */
  private readonly touched = new Set<keyof MatchSetup>();
  /** The readable part of a stored setup that arrived during a match. */
  private pending: ReadableMatchSetup | null = null;

  private readonly changes = new Subject<void>();
  /** Emits each time the setup in the store changes. */
  public readonly changes$: Observable<void> = this.changes.asObservable();

  public constructor(
    private readonly gameState: GameStateService,
    private readonly store: GameStateStore
  ) {
    // Synchronous, so a change is told apart from a restored setup.
    this.store
      .select$(() => this.current(), sameMatchSetup)
      .pipe(pairwise())
      .subscribe(([before, after]) => {
        this.touch(before, after);
        this.changes.next();
      });
    this.store
      .select$(() => this.store.currentState())
      .pipe(filter((state) => state === GameState.START))
      .subscribe(() => this.restorePending());
  }

  /** Applies a stored setup now, or once the match under way is over. */
  public restore(stored: Readonly<Record<string, unknown>>): void {
    const readable = readMatchSetup(stored);
    if (isMatchOn(this.store.snapshot().currentState)) {
      this.pending = readable;
    } else {
      this.apply(readable);
    }
  }

  /**
   * The setup to store: the current one, but while a stored setup waits for
   * the menu, its values for what the player has not changed.
   */
  public toStore(): MatchSetup {
    const setup = this.current();
    const pending = this.pending;
    if (pending === null) {
      return setup;
    }
    return { ...setup, ...this.untouched(pending) };
  }

  private touch(before: MatchSetup, after: MatchSetup): void {
    MATCH_SETUP_KEYS.filter((key) => !sameValue(key, before, after)).forEach(
      (key) => this.touched.add(key)
    );
  }

  /** The stored setup a late answer found under way, once the menu is back. */
  private restorePending(): void {
    const stored = this.pending;
    // A series under way keeps its setup too - the stored one waits for it
    // to end.
    const { series } = this.store.snapshot();
    if (stored !== null && (series === null || seriesWinner(series) !== null)) {
      // Still pending while it is applied, so the write on the way stores
      // the same setup - and the backend skips it.
      this.apply(stored);
      this.pending = null;
    }
  }

  /**
   * Applies a stored setup, keeping what the player changed - all of it at
   * once, so the colonies are spawned again only once.
   */
  private apply(stored: ReadableMatchSetup): void {
    this.gameState.applySetup(this.untouched(stored));
  }

  /** The values of a setup for what the player has not changed. */
  private untouched(setup: ReadableMatchSetup): ReadableMatchSetup {
    const kept: ReadableMatchSetup = {};
    for (const key of MATCH_SETUP_KEYS) {
      if (!this.touched.has(key)) {
        setPart(kept, key, setup[key]);
      }
    }
    return kept;
  }

  /** The match setup as it stands, without tracking it. */
  private current(): MatchSetup {
    return untracked(
      () =>
        Object.fromEntries(
          MATCH_SETUP_KEYS.map((key) => [key, this.store[key]()])
        ) as MatchSetup
    );
  }
}

/** The parts of a stored setup the game can read; the rest is left out. */
function readMatchSetup(
  stored: Readonly<Record<string, unknown>>
): ReadableMatchSetup {
  const readable: ReadableMatchSetup = {};
  for (const key of MATCH_SETUP_KEYS) {
    setPart(readable, key, MATCH_SETUP[key](stored[key]));
  }
  return readable;
}

/** Sets one part of a setup, leaving it out when there is no value. */
function setPart<K extends keyof MatchSetup>(
  setup: ReadableMatchSetup,
  key: K,
  value: MatchSetup[K] | undefined
): void {
  if (value !== undefined) {
    setup[key] = value;
  }
}

function sameMatchSetup(a: MatchSetup, b: MatchSetup): boolean {
  return MATCH_SETUP_KEYS.every((key) => sameValue(key, a, b));
}

function sameValue(
  key: keyof MatchSetup,
  a: MatchSetup,
  b: MatchSetup
): boolean {
  return key === 'colors' ? sameColors(a.colors, b.colors) : a[key] === b[key];
}
