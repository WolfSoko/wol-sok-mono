import { Injectable, inject, signal } from '@angular/core';
import { distinctUntilChanged, filter, pairwise, take } from 'rxjs';
import {
  DEFAULT_SCREEN_RESOLUTION,
  DEFAULT_SIM_RESOLUTION,
  SCREEN_RESOLUTIONS,
  ScreenResolution,
  SIM_RESOLUTIONS,
  SimResolution,
} from './state/arena-size';
import { BotDifficulty, difficultyOption } from './state/bot-controller';
import { sameColors, validColorPair } from './state/colony-colors';
import { GameStateQuery } from './state/game-state.query';
import { GameStateService, MatchSetup } from './state/game-state.service';
import { GameMode, GameState, isMatchOn } from './state/game.states';
import { LEVELS } from './state/levels';
import {
  HeadStart,
  isHeadStart,
  isSeriesLength,
  SeriesLength,
  seriesWinner,
} from './state/rivalry';
import { isObject } from './state/is-object';
import { GameStorage } from './storage/game-storage';

/** What the game remembers between visits. */
export interface StoredSettings {
  mode?: GameMode;
  difficulty?: BotDifficulty;
  levelId?: string;
  showFps?: boolean;
  /** Every level open against the computer, instead of the campaign ladder. */
  freePlay?: boolean;
  /** The id of the level whose arena every level is drawn in, absent for each its own. */
  arena?: string;
  sound?: boolean;
  music?: boolean;
  /** The colour ids of the left and the right colony. */
  colors?: [string, string];
  /** Between two players: how many matches a series is the best of. */
  seriesLength?: SeriesLength;
  /** Between two players: who starts bigger. */
  headStart?: HeadStart;
  look?: BacteriaLook;
  simResolution?: SimResolution;
  screenResolution?: ScreenResolution;
}

/**
 * How the bacteria are drawn: as one gooey, glossy slime per colony, or as
 * the crisp pixels the game started with.
 */
export type BacteriaLook = 'slime' | 'pixels';

export const BACTERIA_LOOKS: readonly { id: BacteriaLook; name: string }[] = [
  { id: 'slime', name: 'Slime' },
  { id: 'pixels', name: 'Pixels' },
];

export const SETTINGS_STORAGE_KEY = 'bacteria-game.settings';

const MODES: readonly GameMode[] = ['vs-computer', 'two-players'];

/** The settings that set up a match - kept in the game state store. */
const MATCH_SETUP_KEYS: readonly (keyof MatchSetup)[] = [
  'mode',
  'difficulty',
  'levelId',
  'colors',
  'seriesLength',
  'headStart',
];

/**
 * Keeps the player's choices - opponent, difficulty, level, colours, the
 * series and the head start between two players, free play or the campaign
 * ladder, the arena, how the bacteria look, the resolutions, whether the
 * frame rate is shown and whether the game makes sound and plays music -
 * across visits, in the game storage.
 *
 * The match settings live in the game state store, as they did; this service
 * only restores them once the storage answers and writes them back whenever
 * they change after that - never before, so the defaults the game starts
 * with cannot overwrite the stored settings. A setting the player changed
 * before the storage answered keeps the player's choice. A match under way
 * keeps its setup: the stored one waits for the menu, and is what gets
 * written meanwhile. Storage that fails simply forgets them.
 */
@Injectable({ providedIn: 'root' })
export class GameSettingsService {
  private readonly gameState = inject(GameStateService);
  private readonly query = inject(GameStateQuery);
  private readonly storage = inject(GameStorage);
  private restored = false;
  /** The settings the player changed - what restoring must keep. */
  private readonly touched = new Set<keyof StoredSettings>();
  /** A stored match setup that arrived during a match, for the next one. */
  private pendingSetup: StoredSettings | null = null;

  /** True while the frame rate badge is shown on the arena. */
  public readonly showFps = signal(false);
  /** True while every level is open, instead of the campaign ladder. */
  public readonly freePlay = signal(false);
  /**
   * The level whose arena every level is drawn in, null for each its own -
   * as chosen. Only an arena the player has earned is drawn
   * (CampaignService.activeArena).
   */
  public readonly arena = signal<string | null>(null);
  /** True while the game makes sound. */
  public readonly sound = signal(true);
  /** True while the levels play their music - under the sound switch. */
  public readonly music = signal(true);
  /** How the bacteria are drawn. */
  public readonly look = signal<BacteriaLook>('slime');
  /** How finely the war is simulated - the arena's size in cells. */
  public readonly simResolution = signal<SimResolution>(DEFAULT_SIM_RESOLUTION);
  /** How many pixels the arena is drawn with. */
  public readonly screenResolution = signal<ScreenResolution>(
    DEFAULT_SCREEN_RESOLUTION
  );

  constructor() {
    this.query
      .select(matchSetup)
      .pipe(distinctUntilChanged(sameMatchSetup), pairwise())
      .subscribe(([before, after]) =>
        this.changed(
          ...MATCH_SETUP_KEYS.filter(
            (key) => JSON.stringify(before[key]) !== JSON.stringify(after[key])
          )
        )
      );
    this.storage
      .watch(SETTINGS_STORAGE_KEY)
      .pipe(take(1))
      .subscribe((stored) => {
        this.restore(isObject(stored) ? (stored as StoredSettings) : {});
        this.restored = true;
        this.persist();
      });
    this.query
      .select((state) => state.currentState)
      .pipe(filter((state) => state === GameState.START))
      .subscribe(() => this.restorePendingSetup());
  }

  public setShowFps(show: boolean): void {
    this.showFps.set(show);
    this.changed('showFps');
  }

  public setArena(levelId: string | null): void {
    this.arena.set(levelId);
    this.changed('arena');
  }

  public setFreePlay(on: boolean): void {
    this.freePlay.set(on);
    this.changed('freePlay');
  }

  public setSound(on: boolean): void {
    this.sound.set(on);
    this.changed('sound');
  }

  public setMusic(on: boolean): void {
    this.music.set(on);
    this.changed('music');
  }

  public setLook(look: BacteriaLook): void {
    this.look.set(look);
    this.changed('look');
  }

  public setSimResolution(resolution: SimResolution): void {
    this.simResolution.set(resolution);
    this.changed('simResolution');
  }

  public setScreenResolution(resolution: ScreenResolution): void {
    this.screenResolution.set(resolution);
    this.changed('screenResolution');
  }

  /**
   * Remembers which settings the player changed, so restoring keeps them,
   * and writes the settings back once they are restored.
   */
  private changed(...keys: (keyof StoredSettings)[]): void {
    keys.forEach((key) => this.touched.add(key));
    if (this.restored) {
      this.persist();
    }
  }

  /**
   * Applies what an earlier visit stored, ignoring anything it cannot read.
   * A setting it does not hold and one the player changed meanwhile keep
   * their value; the match setup waits while a match is on.
   */
  private restore(stored: StoredSettings): void {
    if (isMatchOn(this.query.getValue().currentState)) {
      this.pendingSetup = stored;
    } else {
      this.restoreMatchSetup(stored);
    }
    const restores = (key: keyof StoredSettings) => !this.touched.has(key);
    if (
      restores('look') &&
      BACTERIA_LOOKS.some((option) => option.id === stored.look)
    ) {
      this.look.set(stored.look as BacteriaLook);
    }
    if (
      restores('simResolution') &&
      SIM_RESOLUTIONS.some((option) => option.id === stored.simResolution)
    ) {
      this.simResolution.set(stored.simResolution as SimResolution);
    }
    if (
      restores('screenResolution') &&
      SCREEN_RESOLUTIONS.some((option) => option.id === stored.screenResolution)
    ) {
      this.screenResolution.set(stored.screenResolution as ScreenResolution);
    }
    if (restores('showFps') && typeof stored.showFps === 'boolean') {
      this.showFps.set(stored.showFps);
    }
    if (
      restores('arena') &&
      LEVELS.some((level) => level.id === stored.arena)
    ) {
      this.arena.set(stored.arena as string);
    }
    if (restores('freePlay') && typeof stored.freePlay === 'boolean') {
      this.freePlay.set(stored.freePlay);
    }
    if (restores('sound') && typeof stored.sound === 'boolean') {
      this.sound.set(stored.sound);
    }
    if (restores('music') && typeof stored.music === 'boolean') {
      this.music.set(stored.music);
    }
  }

  /** The stored setup of the match a late answer found under way. */
  private restorePendingSetup(): void {
    const stored = this.pendingSetup;
    // A series under way keeps its setup too - the stored one waits for it
    // to end.
    const { series } = this.query.getValue();
    if (stored !== null && (series === null || seriesWinner(series) !== null)) {
      // Still pending while it is applied, so the write on the way stores
      // the same setup - and the backend skips it.
      this.restoreMatchSetup(stored);
      this.pendingSetup = null;
    }
  }

  /**
   * Applies a stored match setup, keeping what the player changed - all of
   * it at once, so the colonies are spawned again only once.
   */
  private restoreMatchSetup(stored: StoredSettings): void {
    const restores = (key: keyof MatchSetup) => !this.touched.has(key);
    const setup: Partial<MatchSetup> = {};
    if (
      restores('mode') &&
      stored.mode != null &&
      MODES.includes(stored.mode)
    ) {
      setup.mode = stored.mode;
    }
    if (
      restores('difficulty') &&
      difficultyOption(stored.difficulty ?? null) != null
    ) {
      setup.difficulty = stored.difficulty as BotDifficulty;
    }
    if (
      restores('levelId') &&
      LEVELS.some((level) => level.id === stored.levelId)
    ) {
      setup.levelId = stored.levelId as string;
    }
    const colors = validColorPair(stored.colors);
    if (restores('colors') && colors != null) {
      setup.colors = colors;
    }
    if (restores('seriesLength') && isSeriesLength(stored.seriesLength)) {
      setup.seriesLength = stored.seriesLength;
    }
    if (restores('headStart') && isHeadStart(stored.headStart)) {
      setup.headStart = stored.headStart;
    }
    this.gameState.applySetup(setup);
  }

  private persist(): void {
    const settings: StoredSettings = {
      ...this.matchSetupToStore(),
      look: this.look(),
      simResolution: this.simResolution(),
      screenResolution: this.screenResolution(),
      showFps: this.showFps(),
      freePlay: this.freePlay(),
      arena: this.arena() ?? undefined,
      sound: this.sound(),
      music: this.music(),
    };
    this.storage.write(SETTINGS_STORAGE_KEY, settings);
  }

  /**
   * The match setup to store: the current one, but while a stored setup
   * waits for the menu, its values for what the player has not changed.
   */
  private matchSetupToStore(): MatchSetup {
    const setup = matchSetup(this.query.getValue());
    const pending = this.pendingSetup;
    if (pending === null) {
      return setup;
    }
    const kept = MATCH_SETUP_KEYS.filter(
      (key) => !this.touched.has(key) && pending[key] !== undefined
    ).map((key) => [key, pending[key]]);
    return { ...setup, ...Object.fromEntries(kept) };
  }
}

function matchSetup(state: MatchSetup): MatchSetup {
  const { mode, difficulty, levelId, colors, seriesLength, headStart } = state;
  return { mode, difficulty, levelId, colors, seriesLength, headStart };
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
