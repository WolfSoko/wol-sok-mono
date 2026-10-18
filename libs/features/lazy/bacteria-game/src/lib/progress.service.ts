import { Injectable, signal } from '@angular/core';
import { BotDifficulty } from './state/bot-controller';
import { getLevel } from './state/levels';
import {
  judgeMatch,
  MatchRecord,
  MedalAward,
  MedalTier,
} from './state/medallions';
import { addMedal, bestMedal, parseProgress } from './state/progress';
import { readStoredJson, storeJson } from './storage';

export const PROGRESS_STORAGE_KEY = 'bacteria-game.progress';

/**
 * Keeps the best medallion a player has won against the computer per level
 * and difficulty - in local storage under a key of its own, so resetting
 * the settings keeps the progress and the other way round.
 */
@Injectable({ providedIn: 'root' })
export class ProgressService {
  private readonly progress = signal(readStoredProgress());

  /** The best medallion of a level at a difficulty. */
  public medal(levelId: string, difficulty: BotDifficulty): MedalTier | null {
    return bestMedal(this.progress(), levelId, difficulty);
  }

  /** Judges a match that has ended, remembers its medallion and returns its award. */
  public recordMatch(record: MatchRecord): MedalAward {
    // Another tab may have won medallions since: build on what is stored.
    this.progress.set(readStoredProgress());
    const previousBest = this.medal(record.levelId, record.difficulty);
    const { medal, hint } = judgeMatch(getLevel(record.levelId).medal, record);
    if (medal != null) {
      this.progress.update((progress) =>
        addMedal(progress, record.levelId, record.difficulty, medal)
      );
      storeJson(PROGRESS_STORAGE_KEY, this.progress());
    }
    return { record, medal, previousBest, hint };
  }
}

function readStoredProgress() {
  return parseProgress(readStoredJson(PROGRESS_STORAGE_KEY));
}
