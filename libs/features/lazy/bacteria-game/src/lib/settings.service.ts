import { Injectable, inject, signal } from '@angular/core';
import { distinctUntilChanged } from 'rxjs';
import { BOT_DIFFICULTIES, BotDifficulty } from './state/bot-controller';
import { GameStateQuery } from './state/game-state.query';
import { GameStateService } from './state/game-state.service';
import { GameMode } from './state/game.states';
import { LEVELS } from './state/levels';

/** What the game remembers between visits. */
export interface StoredSettings {
  mode?: GameMode;
  difficulty?: BotDifficulty;
  levelId?: string;
  showFps?: boolean;
}

export const SETTINGS_STORAGE_KEY = 'bacteria-game.settings';

const MODES: readonly GameMode[] = ['vs-computer', 'two-players'];

/**
 * Keeps the player's choices - opponent, difficulty, level and whether the
 * frame rate is shown - across visits, in the browser's local storage.
 *
 * The match settings live in the game state store, as they did; this service
 * only restores them when the game is opened and writes them back whenever
 * they change. A browser that refuses storage (private mode, a blocked site)
 * simply forgets them.
 */
@Injectable({ providedIn: 'root' })
export class GameSettingsService {
  private readonly gameState = inject(GameStateService);
  private readonly query = inject(GameStateQuery);

  /** True while the frame rate badge is shown on the arena. */
  public readonly showFps = signal(false);

  constructor() {
    this.restore();
    this.query
      .select((state) => ({
        mode: state.mode,
        difficulty: state.difficulty,
        levelId: state.levelId,
      }))
      .pipe(
        distinctUntilChanged(
          (a, b) =>
            a.mode === b.mode &&
            a.difficulty === b.difficulty &&
            a.levelId === b.levelId
        )
      )
      .subscribe(() => this.persist());
  }

  public setShowFps(show: boolean): void {
    this.showFps.set(show);
    this.persist();
  }

  /** Applies what an earlier visit stored, ignoring anything it cannot read. */
  private restore(): void {
    const stored = readStoredSettings();
    if (stored.mode != null && MODES.includes(stored.mode)) {
      this.gameState.setMode(stored.mode);
    }
    if (BOT_DIFFICULTIES.some((option) => option.id === stored.difficulty)) {
      this.gameState.setDifficulty(stored.difficulty as BotDifficulty);
    }
    if (LEVELS.some((level) => level.id === stored.levelId)) {
      this.gameState.setLevel(stored.levelId as string);
    }
    this.showFps.set(stored.showFps === true);
  }

  private persist(): void {
    const { mode, difficulty, levelId } = this.query.getValue();
    const settings: StoredSettings = {
      mode,
      difficulty,
      levelId,
      showFps: this.showFps(),
    };
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Storage refused - the settings last for this visit only.
    }
  }
}

/** The stored settings, or nothing when there are none or they are unreadable. */
function readStoredSettings(): StoredSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    const parsed: unknown = raw == null ? null : JSON.parse(raw);
    return typeof parsed === 'object' && parsed != null
      ? (parsed as StoredSettings)
      : {};
  } catch {
    return {};
  }
}
