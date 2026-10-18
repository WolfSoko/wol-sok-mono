import { Injectable, signal } from '@angular/core';
import { BotDifficulty } from './state/bot-controller';
import { getLevel } from './state/levels';
import {
  judgeMatch,
  MatchRecord,
  MedalAward,
  MedalTier,
} from './state/medallions';
import {
  applyMatch,
  levelRecord,
  parseProgress,
  Progress,
} from './state/progress';
import { readStoredJson, storeJson } from './storage';

export const PROGRESS_STORAGE_KEY = 'bacteria-game.progress';

/**
 * Keeps the medallions a player has won against the computer, with the
 * number of wins and the fastest one, per level and difficulty - in local
 * storage under a key of its own, so resetting the settings keeps the
 * progress and the other way round.
 */
@Injectable({ providedIn: 'root' })
export class ProgressService {
  private readonly progress = signal<Progress>(
    parseProgress(readStoredJson(PROGRESS_STORAGE_KEY))
  );

  /** The best medallion of a level at a difficulty. */
  public medal(levelId: string, difficulty: BotDifficulty): MedalTier | null {
    return levelRecord(this.progress(), levelId, difficulty)?.medal ?? null;
  }

  /** Judges a match that has ended, remembers it and returns its award. */
  public recordMatch(record: MatchRecord): MedalAward {
    const previousBest = this.medal(record.levelId, record.difficulty);
    const { medal, hint } = judgeMatch(getLevel(record.levelId).medal, record);
    this.progress.update((progress) => applyMatch(progress, record, medal));
    storeJson(PROGRESS_STORAGE_KEY, this.progress());
    return { record, medal, previousBest, hint };
  }
}
