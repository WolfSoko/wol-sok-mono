import { Injectable, signal } from '@angular/core';
import { BotDifficulty } from './state/bot-controller';
import { getLevel } from './state/levels';
import {
  MatchRecord,
  medalFor,
  medalHint,
  medalRank,
  MedalTier,
} from './state/medallions';
import {
  applyMatch,
  EMPTY_PROGRESS,
  levelRecord,
  parseProgress,
  Progress,
} from './state/progress';

export const PROGRESS_STORAGE_KEY = 'bacteria-game.progress';

/** What the match that just ended earned, for the result screen. */
export interface MedalAward {
  record: MatchRecord;
  /** The medallion this match earned, null for a loss or a draw. */
  medal: MedalTier | null;
  /** True when it beats the best medallion the level had before. */
  isNewBest: boolean;
  /** What the next medallion needs, null after a platinum. */
  hint: string | null;
}

/**
 * Keeps the medallions and best times a player has won against the
 * computer, per level and difficulty, in the browser's local storage - under
 * a key of its own, so resetting the settings keeps the progress and the
 * other way round. A browser that refuses storage keeps them for the visit.
 */
@Injectable({ providedIn: 'root' })
export class ProgressService {
  private readonly progressSignal = signal<Progress>(readStoredProgress());
  public readonly progress = this.progressSignal.asReadonly();

  private readonly awardSignal = signal<MedalAward | null>(null);
  /** What the last match earned, until the next one starts. */
  public readonly lastAward = this.awardSignal.asReadonly();

  /** The best medallion of a level at a difficulty. */
  public medal(levelId: string, difficulty: BotDifficulty): MedalTier | null {
    return levelRecord(this.progress(), levelId, difficulty)?.medal ?? null;
  }

  /** Judges a match that has ended, remembers it and returns its award. */
  public recordMatch(record: MatchRecord): MedalAward {
    const limits = getLevel(record.levelId).medal;
    const medal = medalFor(limits, record);
    const before = this.medal(record.levelId, record.difficulty);
    const award: MedalAward = {
      record,
      medal,
      isNewBest: medalRank(medal) > medalRank(before),
      hint: medalHint(limits, record),
    };
    this.progressSignal.update((progress) =>
      applyMatch(progress, record, medal)
    );
    this.awardSignal.set(award);
    this.persist();
    return award;
  }

  /** Forgets the last award, as the next match starts. */
  public clearAward(): void {
    this.awardSignal.set(null);
  }

  private persist(): void {
    try {
      localStorage.setItem(
        PROGRESS_STORAGE_KEY,
        JSON.stringify(this.progress())
      );
    } catch {
      // Storage refused - the progress lasts for this visit only.
    }
  }
}

function readStoredProgress(): Progress {
  try {
    const raw = localStorage.getItem(PROGRESS_STORAGE_KEY);
    return raw == null ? EMPTY_PROGRESS : parseProgress(JSON.parse(raw));
  } catch {
    return EMPTY_PROGRESS;
  }
}
