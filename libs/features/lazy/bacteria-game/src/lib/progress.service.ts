import { Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { BotDifficulty } from './state/bot-controller';
import { ladderLocks } from './state/campaign';
import { getLevel } from './state/levels';
import {
  judgeMatch,
  MatchRecord,
  MedalAward,
  MedalTier,
} from './state/medallions';
import { AchievementId } from './state/achievement-ids';
import { earnAchievements } from './state/achievements';
import {
  addMedal,
  addTotals,
  bestMedal,
  EMPTY_PROGRESS,
  mergeProgress,
  parseProgress,
  Progress,
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
  /** True once the storage has answered - before, nothing is known yet. */
  public readonly loaded = signal(false);

  constructor() {
    this.storage
      .watch(PROGRESS_STORAGE_KEY)
      .pipe(map(parseProgress), takeUntilDestroyed())
      .subscribe((stored) => {
        this.progress.update((progress) => mergeProgress(progress, stored));
        this.loaded.set(true);
      });
  }

  /** Every medallion held, by level id, then by difficulty. */
  public readonly medals = computed(() => this.progress().medals);

  /** The best medallion of a level at a difficulty. */
  public medal(levelId: string, difficulty: BotDifficulty): MedalTier | null {
    return bestMedal(this.progress(), levelId, difficulty);
  }

  /**
   * Why each level is still locked on the campaign ladder, by level id - the
   * open ones are absent. It follows every medallion won.
   */
  public readonly ladderLocks = computed(() => ladderLocks(this.progress()));

  /** Every achievement earned, with the day it was earned. */
  public readonly achievements = computed(() => this.progress().achievements);

  /** What the player has done over all their matches. */
  public readonly totals = computed(() => this.progress().totals);

  /**
   * Judges a match against the computer that has ended, remembers its
   * medallion, its numbers and the achievements it earned, and returns its
   * award.
   */
  public recordMatch(record: MatchRecord): MedalAward {
    const previousBest = this.medal(record.levelId, record.difficulty);
    const { medal, hint } = judgeMatch(getLevel(record.levelId).medal, record);
    let progress =
      medal === null
        ? this.progress()
        : addMedal(this.progress(), record.levelId, record.difficulty, medal);
    progress = addTotals(progress, {
      matches: 1,
      wins: record.won ? 1 : 0,
      captured: record.captured,
      // What the computer lost that nobody captured, the walls crushed.
      enemyCrushed: Math.max(0, record.enemyLost - record.captured),
    });
    const earned = earnAchievements(progress, record, today());
    this.save(earned.progress);
    return { record, medal, previousBest, hint, achievements: earned.earned };
  }

  /**
   * Counts a match between two players that has ended, and returns the
   * achievements it earned.
   */
  public recordCouchMatch(): readonly AchievementId[] {
    const earned = earnAchievements(
      addTotals(this.progress(), { couchMatches: 1 }),
      null,
      today()
    );
    this.save(earned.progress);
    return earned.earned;
  }

  private save(progress: Progress): void {
    this.progress.set(progress);
    this.storage.update(PROGRESS_STORAGE_KEY, (stored) =>
      mergeProgress(parseProgress(stored), progress)
    );
  }
}

/** Today as an ISO date, "2026-10-19" - the day an achievement is earned. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}
