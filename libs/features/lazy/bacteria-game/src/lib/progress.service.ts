import { Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { BotDifficulty } from './state/bot-controller';
import { lockedReason } from './state/campaign';
import { getLevel } from './state/levels';
import {
  judgeMatch,
  MatchRecord,
  MedalAward,
  MedalTier,
} from './state/medallions';
import {
  addMedal,
  bestMedal,
  EMPTY_PROGRESS,
  mergeProgress,
  parseProgress,
} from './state/progress';
import { GameStorage } from './storage/game-storage';

export const PROGRESS_STORAGE_KEY = 'bacteria-game.progress';

/**
 * Keeps the best medallion a player has won against the computer per level
 * and difficulty - in the game storage under a key of its own, so resetting
 * the settings keeps the progress and the other way round.
 *
 * The medallions won here and the stored ones are merged, never replaced:
 * whatever another tab or device stores, and whenever the storage answers,
 * no medallion is lost.
 */
@Injectable({ providedIn: 'root' })
export class ProgressService {
  private readonly storage = inject(GameStorage);
  private readonly progress = signal(EMPTY_PROGRESS);

  constructor() {
    this.storage
      .watch(PROGRESS_STORAGE_KEY)
      .pipe(map(parseProgress), takeUntilDestroyed())
      .subscribe((stored) =>
        this.progress.update((progress) => mergeProgress(progress, stored))
      );
  }

  /** The best medallion of a level at a difficulty. */
  public medal(levelId: string, difficulty: BotDifficulty): MedalTier | null {
    return bestMedal(this.progress(), levelId, difficulty);
  }

  /**
   * Why a level is still locked on the campaign ladder, null when it is open.
   * Read in a computed, it follows every medallion won.
   */
  public lockedReason(levelId: string): string | null {
    return lockedReason(this.progress(), levelId);
  }

  /** Judges a match that has ended, remembers its medallion and returns its award. */
  public recordMatch(record: MatchRecord): MedalAward {
    const previousBest = this.medal(record.levelId, record.difficulty);
    const { medal, hint } = judgeMatch(getLevel(record.levelId).medal, record);
    const progress =
      medal === null
        ? this.progress()
        : addMedal(this.progress(), record.levelId, record.difficulty, medal);
    if (progress !== this.progress()) {
      this.progress.set(progress);
      this.storage.update(PROGRESS_STORAGE_KEY, (stored) =>
        mergeProgress(parseProgress(stored), progress)
      );
    }
    return { record, medal, previousBest, hint };
  }
}
