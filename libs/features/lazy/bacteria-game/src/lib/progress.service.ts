import { Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { BotDifficulty } from './state/bot-controller';
import { ladderLocks, newlyUnlocked } from './state/campaign';
import { getLevel } from './state/levels';
import { judgeMatch, MatchRecord, MedalTier } from './state/medallions';
import { earnAchievements } from './state/achievements';
import { MatchEarnings } from './state/earnings';
import { arenaLocks, colorLocks, newCosmetics } from './state/unlocks';
import { COUCH_XP, matchXp, xpGain, xpOf } from './state/xp';
import {
  addMedal,
  addTotals,
  bestMedal,
  EMPTY_PROGRESS,
  LifetimeTotals,
  mergeProgress,
  NO_TOTALS,
  parseProgress,
  Progress,
  totalsOf,
} from './state/progress';
import { GameStorage } from './storage/game-storage';

export const PROGRESS_STORAGE_KEY = 'bacteria-game.progress';

/**
 * Keeps the best medallion a player has won against the computer per level
 * and difficulty - in the game storage under a key of its own, so resetting
 * the settings keeps the progress and the other way round.
 *
 * Also counts what every match did and earns the achievements. Medallions
 * and achievements won here and the stored ones are merged, never
 * replaced, and a match's numbers are added to the stored totals: whatever
 * another tab or device stores, and whenever the storage answers, nothing
 * is lost.
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
        // What the stored progress earns on its own - a medallion won before
        // the achievement existed, say - is earned now, quietly, rather
        // than credited to whichever match comes next.
        const { progress, earned } = earnAchievements(
          mergeProgress(this.progress(), stored),
          null,
          today()
        );
        this.progress.set(progress);
        this.loaded.set(true);
        if (earned.length > 0) {
          this.store(progress, {});
        }
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

  /** The XP the progress is worth, which decides the rank. */
  public readonly xp = computed(() => xpOf(this.progress()));

  /** Why each colony colour still to earn is locked, by colour id. */
  public readonly colorLocks = computed(() => colorLocks(this.progress()));

  /** Why each level's arena is still locked, by level id. */
  public readonly arenaLocks = computed(() => arenaLocks(this.progress()));

  private cosmeticLocks() {
    return { colors: this.colorLocks(), arenas: this.arenaLocks() };
  }

  /**
   * Judges a match against the computer that has ended, remembers its
   * medallion, its numbers, the achievements and the XP it earned, and
   * returns what it earned.
   */
  public recordMatch(record: MatchRecord): MatchEarnings {
    const previousBest = this.medal(record.levelId, record.difficulty);
    const { medal, hint } = judgeMatch(getLevel(record.levelId).medal, record);
    return {
      award: { record, medal, previousBest, hint },
      ...this.record(
        (progress) =>
          medal === null
            ? progress
            : addMedal(progress, record.levelId, record.difficulty, medal),
        { ...totalsOf(record), matchXp: matchXp(record) },
        record
      ),
    };
  }

  /** Counts a match between two players that has ended, and returns what it earned. */
  public recordCouchMatch(): MatchEarnings {
    return {
      award: null,
      ...this.record(
        (progress) => progress,
        { couchMatches: 1, matchXp: COUCH_XP },
        null
      ),
    };
  }

  /**
   * Applies a match: its medallion, its numbers and the achievements they
   * earn - here, and in the storage - and works out its XP and the levels
   * it opened. Before the storage has answered, what was held before is not
   * known: the match counts all the same, but where it leaves the player is
   * left out rather than guessed.
   */
  private record(
    gain: (progress: Progress) => Progress,
    match: Partial<LifetimeTotals>,
    record: MatchRecord | null
  ): Omit<MatchEarnings, 'award'> {
    const before = this.progress();
    const locksBefore = this.ladderLocks();
    const cosmeticsBefore = this.cosmeticLocks();
    const known = this.loaded();
    const { progress, earned } = earnAchievements(
      addTotals(gain(before), match),
      record,
      today()
    );
    this.progress.set(progress);
    this.store(progress, match);
    return {
      achievements: earned,
      xp: xpGain(before, progress, record),
      xpBefore: known ? xpOf(before) : null,
      unlocked: known
        ? newlyUnlocked(locksBefore, this.ladderLocks()).filter(
            (id) => id !== record?.levelId
          )
        : [],
      cosmetics: known
        ? newCosmetics(cosmeticsBefore, this.cosmeticLocks())
        : [],
    };
  }

  /**
   * Writes the progress: medallions and achievements merge with the stored
   * ones, the match's numbers are added to the stored totals - not to the
   * ones here, which miss what the storage has not told yet. So no match is
   * lost, whenever the storage answers and whoever else writes.
   */
  private store(progress: Progress, match: Partial<LifetimeTotals>): void {
    const gains = { ...progress, totals: NO_TOTALS };
    this.storage.update(PROGRESS_STORAGE_KEY, (stored) =>
      mergeProgress(addTotals(parseProgress(stored), match), gains)
    );
  }
}

/** Today as an ISO date in the player's time zone, "2026-10-19". */
function today(): string {
  const now = new Date();
  const two = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}`;
}
