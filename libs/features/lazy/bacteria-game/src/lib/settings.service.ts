import { Injectable, inject, signal } from '@angular/core';
import { distinctUntilChanged, pairwise, take } from 'rxjs';
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
import { GameStateService } from './state/game-state.service';
import { GameMode, GameStateState, isMatchOn } from './state/game.states';
import { LEVELS } from './state/levels';
import { isObject } from './state/is-object';
import { GameStorage } from './storage/game-storage';

/** What the game remembers between visits. */
export interface StoredSettings {
  mode?: GameMode;
  difficulty?: BotDifficulty;
  levelId?: string;
  showFps?: boolean;
  sound?: boolean;
  music?: boolean;
  /** The colour ids of the left and the right colony. */
  colors?: [string, string];
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
type MatchSetup = Pick<
  GameStateState,
  'mode' | 'difficulty' | 'levelId' | 'colors'
>;

const MATCH_SETUP_KEYS: readonly (keyof MatchSetup)[] = [
  'mode',
  'difficulty',
  'levelId',
  'colors',
];

/**
 * Keeps the player's choices - opponent, difficulty, level, colours, how the
 * bacteria look, the resolutions, whether the frame rate is shown and whether
 * the game makes sound and plays music - across visits, in the game storage.
 *
 * The match settings live in the game state store, as they did; this service
 * only restores them once the storage answers and writes them back whenever
 * they change after that - never before, so the defaults the game starts
 * with cannot overwrite the stored settings. A setting the player changed
 * before the storage answered keeps the player's choice, and a match under
 * way keeps its setup. Storage that fails simply forgets them.
 */
@Injectable({ providedIn: 'root' })
export class GameSettingsService {
  private readonly gameState = inject(GameStateService);
  private readonly query = inject(GameStateQuery);
  private readonly storage = inject(GameStorage);
  private restored = false;
  /** The settings the player changed before the storage answered. */
  private readonly touched = new Set<keyof StoredSettings>();

  /** True while the frame rate badge is shown on the arena. */
  public readonly showFps = signal(false);
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
  }

  public setShowFps(show: boolean): void {
    this.showFps.set(show);
    this.changed('showFps');
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
   * Writes the settings back once they are restored; before that, remembers
   * which ones the player changed, so restoring keeps them.
   */
  private changed(...keys: (keyof StoredSettings)[]): void {
    if (this.restored) {
      this.persist();
    } else {
      keys.forEach((key) => this.touched.add(key));
    }
  }

  /**
   * Applies what an earlier visit stored, ignoring anything it cannot read.
   * A setting it does not hold, one the player changed meanwhile, and the
   * setup of a match under way keep their value.
   */
  private restore(stored: StoredSettings): void {
    const matchOn = isMatchOn(this.query.getValue().currentState);
    const restores = (key: keyof StoredSettings) =>
      !this.touched.has(key) &&
      !(matchOn && (MATCH_SETUP_KEYS as readonly string[]).includes(key));

    if (
      restores('mode') &&
      stored.mode != null &&
      MODES.includes(stored.mode)
    ) {
      this.gameState.setMode(stored.mode);
    }
    if (
      restores('difficulty') &&
      difficultyOption(stored.difficulty ?? null) != null
    ) {
      this.gameState.setDifficulty(stored.difficulty as BotDifficulty);
    }
    if (
      restores('levelId') &&
      LEVELS.some((level) => level.id === stored.levelId)
    ) {
      this.gameState.setLevel(stored.levelId as string);
    }
    const colors = validColorPair(stored.colors);
    if (restores('colors') && colors != null) {
      this.gameState.setColors(colors);
    }
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
    if (restores('sound') && typeof stored.sound === 'boolean') {
      this.sound.set(stored.sound);
    }
    if (restores('music') && typeof stored.music === 'boolean') {
      this.music.set(stored.music);
    }
  }

  private persist(): void {
    const { mode, difficulty, levelId, colors } = this.query.getValue();
    const settings: StoredSettings = {
      mode,
      difficulty,
      levelId,
      colors,
      look: this.look(),
      simResolution: this.simResolution(),
      screenResolution: this.screenResolution(),
      showFps: this.showFps(),
      sound: this.sound(),
      music: this.music(),
    };
    this.storage.write(SETTINGS_STORAGE_KEY, settings);
  }
}

function matchSetup(state: MatchSetup): MatchSetup {
  const { mode, difficulty, levelId, colors } = state;
  return { mode, difficulty, levelId, colors };
}

function sameMatchSetup(a: MatchSetup, b: MatchSetup): boolean {
  return (
    a.mode === b.mode &&
    a.difficulty === b.difficulty &&
    a.levelId === b.levelId &&
    sameColors(a.colors, b.colors)
  );
}
