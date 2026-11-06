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

/** The settings that set up a match - kept in the game state store. */
export const MATCH_SETUP_KEYS: readonly (keyof MatchSetup)[] = [
  'mode',
  'difficulty',
  'levelId',
  'colors',
  'seriesLength',
  'headStart',
];

/** The match setup as it is stored beside the device settings. */
export type StoredMatchSetupValues = Partial<MatchSetup>;

/**
 * Restores the match setup the game state store keeps and gives it back to
 * store. A setup the player changed keeps the player's choice. A match or
 * series under way keeps its setup: the stored one waits for the menu, and
 * is what gets stored meanwhile.
 */
export class StoredMatchSetup {
  /** The parts of the setup the player changed - what restoring must keep. */
  private readonly touched = new Set<keyof MatchSetup>();
  /** A stored setup that arrived during a match, for the next one. */
  private pending: StoredMatchSetupValues | null = null;

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
    if (isMatchOn(this.store.snapshot().currentState)) {
      this.pending = stored as StoredMatchSetupValues;
    } else {
      this.apply(stored);
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
    const kept = MATCH_SETUP_KEYS.filter(
      (key) => !this.touched.has(key) && pending[key] !== undefined
    ).map((key) => [key, pending[key]]);
    return { ...setup, ...Object.fromEntries(kept) };
  }

  private touch(before: MatchSetup, after: MatchSetup): void {
    MATCH_SETUP_KEYS.filter(
      (key) => JSON.stringify(before[key]) !== JSON.stringify(after[key])
    ).forEach((key) => this.touched.add(key));
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
  private apply(stored: Readonly<Record<string, unknown>>): void {
    const restores = (key: keyof MatchSetup) => !this.touched.has(key);
    const setup: Partial<MatchSetup> = {};
    if (restores('mode') && isGameMode(stored['mode'])) {
      setup.mode = stored['mode'];
    }
    const difficulty = stored['difficulty'] as BotDifficulty | undefined;
    if (
      restores('difficulty') &&
      difficultyOption(difficulty ?? null) != null
    ) {
      setup.difficulty = difficulty;
    }
    if (restores('levelId') && isLevelId(stored['levelId'])) {
      setup.levelId = stored['levelId'];
    }
    const colors = validColorPair(stored['colors']);
    if (restores('colors') && colors != null) {
      setup.colors = colors;
    }
    if (restores('seriesLength') && isSeriesLength(stored['seriesLength'])) {
      setup.seriesLength = stored['seriesLength'];
    }
    if (restores('headStart') && isHeadStart(stored['headStart'])) {
      setup.headStart = stored['headStart'];
    }
    this.gameState.applySetup(setup);
  }

  /** The match setup as it stands, without tracking it. */
  private current(): MatchSetup {
    const { mode, difficulty, levelId, colors, seriesLength, headStart } =
      this.store;
    return untracked(() => ({
      mode: mode(),
      difficulty: difficulty(),
      levelId: levelId(),
      colors: colors(),
      seriesLength: seriesLength(),
      headStart: headStart(),
    }));
  }
}

function sameMatchSetup(a: MatchSetup, b: MatchSetup): boolean {
  return (
    a.mode === b.mode &&
    a.difficulty === b.difficulty &&
    a.levelId === b.levelId &&
    sameColors(a.colors, b.colors) &&
    a.seriesLength === b.seriesLength &&
    a.headStart === b.headStart
  );
}
