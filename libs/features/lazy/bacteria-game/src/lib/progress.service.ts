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
  DAILY_ATTEMPTS,
  dailyLevelId,
  standingStreak,
  utcDay,
} from './state/daily';
import {
  addCouchWin,
  addDailyAttempt,
  dailyAttempts,
  addMedal,
  addTotals,
  bestMedal,
  EMPTY_PROGRESS,
  mergeProgress,
  NO_TOTALS,
  parseProgress,
  Progress,
  totalsOf,
} from './state/progress';
import { GameStorage } from './storage/game-storage';

export const PROGRESS_STORAGE_KEY = 'bacteria-game.progress';

/** Today's daily level as the main menu offers it. */
export interface DailyOffer {
  levelId: string;
  /** Attempts left today that count towards its medallion. */
  attemptsLeft: number;
  /** Days in a row it has been played, 0 without a streak. */
  streak: number;
}

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
          this.store(progress, (stored) => stored);
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
    const judged = judgeMatch(getLevel(record.levelId).medal, record);
    const day = utcDay(new Date());
    const daily = record.levelId === dailyLevelId(day);
    const attempt = daily ? dailyAttempts(this.progress(), day) + 1 : 0;
    // Past the attempts of the day, the daily level is practice.
    const practice = attempt > DAILY_ATTEMPTS;
    const { medal, hint } = practice
      ? {
          medal: null,
          hint: `Your ${DAILY_ATTEMPTS} attempts of the day are used - this one was practice.`,
        }
      : judged;
    const earnings: MatchEarnings = {
      award: { record, medal, previousBest, hint },
      ...this.record(
        (progress) =>
          medal === null
            ? progress
            : addMedal(progress, record.levelId, record.difficulty, medal),
        (progress) => {
          const counted = addTotals(progress, {
            ...totalsOf(record),
            matchXp: matchXp(record),
          });
          return daily ? addDailyAttempt(counted, day) : counted;
        },
        record
      ),
    };
    return daily
      ? {
          ...earnings,
          daily: {
            attempt,
            counted: !practice,
            streak: standingStreak(this.progress().streak, day),
          },
        }
      : earnings;
  }

  /** Today's daily level, its attempts left and the streak, for the menu. */
  public readonly daily = computed((): DailyOffer => {
    const day = utcDay(new Date());
    const progress = this.progress();
    return {
      levelId: dailyLevelId(day),
      attemptsLeft: Math.max(0, DAILY_ATTEMPTS - dailyAttempts(progress, day)),
      streak: standingStreak(progress.streak, day),
    };
  });

  /**
   * Counts a match between two players that has ended - won by the colony
   * of that colour, null for a draw - and returns what it earned.
   */
  public recordCouchMatch(winnerColor: string | null): MatchEarnings {
    return {
      award: null,
      ...this.record(
        (progress) => progress,
        (progress) => {
          const counted = addTotals(progress, {
            couchMatches: 1,
            matchXp: COUCH_XP,
          });
          return winnerColor === null
            ? counted
            : addCouchWin(counted, winnerColor);
        },
        null
      ),
    };
  }

  /** The wins between two players, by the winning colony's colour. */
  public readonly couchWins = computed(() => this.progress().couchWins);

  /**
   * Applies a match - what it won that merges (`gain`: a medallion) and
   * what it adds to the counts (`count`: the totals, a colour's win), with
   * the achievements they earn - here, and in the storage - and works out
   * its XP and what it opened. Before the storage has answered, what was held before is not
   * known: the match counts all the same, but where it leaves the player is
   * left out rather than guessed.
   */
  private record(
    gain: (progress: Progress) => Progress,
    count: (progress: Progress) => Progress,
    record: MatchRecord | null
  ): Omit<MatchEarnings, 'award'> {
    const before = this.progress();
    const locksBefore = this.ladderLocks();
    const cosmeticsBefore = this.cosmeticLocks();
    const known = this.loaded();
    const { progress, earned } = earnAchievements(
      count(gain(before)),
      record,
      today()
    );
    this.progress.set(progress);
    this.store(progress, count);
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
   * ones, the match's counts are added to the stored ones - not to the
   * ones here, which miss what the storage has not told yet. So no match is
   * lost, whenever the storage answers and whoever else writes.
   */
  private store(
    progress: Progress,
    count: (progress: Progress) => Progress
  ): void {
    const gains = {
      ...progress,
      totals: NO_TOTALS,
      couchWins: {},
      daily: null,
      streak: null,
    };
    this.storage.update(PROGRESS_STORAGE_KEY, (stored) =>
      mergeProgress(count(parseProgress(stored)), gains)
    );
  }
}

/** Today as an ISO date in the player's time zone, "2026-10-19". */
function today(): string {
  const now = new Date();
  const two = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}`;
}
