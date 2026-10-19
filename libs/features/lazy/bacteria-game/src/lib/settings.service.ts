import { Injectable, inject, signal } from '@angular/core';
import { distinctUntilChanged, take } from 'rxjs';
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
import { GameMode } from './state/game.states';
import { LEVELS } from './state/levels';
import { GameStorage, isObject } from './storage/game-storage';

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

/**
 * Keeps the player's choices - opponent, difficulty, level, colours, how the
 * bacteria look, the resolutions, whether the frame rate is shown and whether
 * the game makes sound and plays music - across visits, in the game storage.
 *
 * The match settings live in the game state store, as they did; this service
 * only restores them once the storage answers and writes them back whenever
 * they change after that - never before, so the defaults the game starts
 * with cannot overwrite the stored settings. Storage that fails simply
 * forgets them.
 */
@Injectable({ providedIn: 'root' })
export class GameSettingsService {
  private readonly gameState = inject(GameStateService);
  private readonly query = inject(GameStateQuery);
  private readonly storage = inject(GameStorage);
  private restored = false;

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
    this.storage
      .watch(SETTINGS_STORAGE_KEY)
      .pipe(take(1))
      .subscribe((stored) => {
        this.restore(isObject(stored) ? (stored as StoredSettings) : {});
        this.restored = true;
        this.persistMatchSetup();
      });
  }

  public setShowFps(show: boolean): void {
    this.showFps.set(show);
    this.persist();
  }

  public setSound(on: boolean): void {
    this.sound.set(on);
    this.persist();
  }

  public setMusic(on: boolean): void {
    this.music.set(on);
    this.persist();
  }

  public setLook(look: BacteriaLook): void {
    this.look.set(look);
    this.persist();
  }

  public setSimResolution(resolution: SimResolution): void {
    this.simResolution.set(resolution);
    this.persist();
  }

  public setScreenResolution(resolution: ScreenResolution): void {
    this.screenResolution.set(resolution);
    this.persist();
  }

  /** Applies what an earlier visit stored, ignoring anything it cannot read. */
  private restore(stored: StoredSettings): void {
    if (stored.mode != null && MODES.includes(stored.mode)) {
      this.gameState.setMode(stored.mode);
    }
    if (difficultyOption(stored.difficulty ?? null) != null) {
      this.gameState.setDifficulty(stored.difficulty as BotDifficulty);
    }
    if (LEVELS.some((level) => level.id === stored.levelId)) {
      this.gameState.setLevel(stored.levelId as string);
    }
    const colors = validColorPair(stored.colors);
    if (colors != null) {
      this.gameState.setColors(colors);
    }
    if (BACTERIA_LOOKS.some((option) => option.id === stored.look)) {
      this.look.set(stored.look as BacteriaLook);
    }
    if (SIM_RESOLUTIONS.some((option) => option.id === stored.simResolution)) {
      this.simResolution.set(stored.simResolution as SimResolution);
    }
    if (
      SCREEN_RESOLUTIONS.some((option) => option.id === stored.screenResolution)
    ) {
      this.screenResolution.set(stored.screenResolution as ScreenResolution);
    }
    this.showFps.set(stored.showFps === true);
    this.sound.set(stored.sound !== false);
    this.music.set(stored.music !== false);
  }

  /** Writes the settings back whenever the match setup in the game state changes. */
  private persistMatchSetup(): void {
    this.query
      .select((state) => ({
        mode: state.mode,
        difficulty: state.difficulty,
        levelId: state.levelId,
        colors: state.colors,
      }))
      .pipe(
        distinctUntilChanged(
          (a, b) =>
            a.mode === b.mode &&
            a.difficulty === b.difficulty &&
            a.levelId === b.levelId &&
            sameColors(a.colors, b.colors)
        )
      )
      .subscribe(() => this.persist());
  }

  private persist(): void {
    if (!this.restored) {
      return;
    }
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
