import {
  DestroyRef,
  Injectable,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { map, switchMap, take } from 'rxjs';
import { BotDifficulty } from './state/bot-controller';
import { ladderLocks, newlyUnlocked } from './state/campaign';
import { getLevel, isLadderLevel, LEVELS } from './state/levels';
import { judgeMatch, MatchRecord, MedalTier } from './state/medallions';
import { earnAchievements } from './state/achievements';
import { MatchEarnings } from './state/earnings';
import { arenaLocks, colorLocks, newCosmetics } from './state/unlocks';
import { COUCH_XP, matchXp, xpGain, xpOf } from './state/xp';
import {
  attemptsOn,
  DAILY_ATTEMPTS,
  dailyLevelId,
  standingStreak,
  utcDay,
} from './state/daily';
import {
  addCouchWin,
  adoptProgress,
  addDailyAttempt,
  addEndlessRun,
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
import { GameAccount, PlayerSwitch } from './storage/game-account';
import { DeviceStorage, GameStorage } from './storage/game-storage';

export const PROGRESS_STORAGE_KEY = 'bacteria-game.progress';

/** What a match was part of, beyond the level it was played on. */
export interface MatchContext {
  /** The UTC day of the daily level it was played as. */
  dailyDay?: string | null;
  /** The levels the endless run it was part of has beaten after it. */
  endlessWins?: number | null;
}

/** What a match on the daily level past the attempts of its day says. */
const PRACTICE_HINT = `Your ${DAILY_ATTEMPTS} attempts of the day are used - this one was practice.`;

/** Today's daily level as the main menu offers it. */
export interface DailyOffer {
  /** The UTC day it is the daily level of. */
  day: string;
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
 *
 * The progress is the player's: when another player takes over - a sign-in
 * or a sign-out - it starts over from theirs.
 */
@Injectable({ providedIn: 'root' })
export class ProgressService {
  private readonly storage = inject(GameStorage);
  private readonly account = inject(GameAccount);
  private readonly device = inject(DeviceStorage);
  private readonly progress = signal(EMPTY_PROGRESS);
  /** True once the storage has answered - before, nothing is known yet. */
  public readonly loaded = signal(false);

  constructor() {
    const clock = setInterval(() => this.today.set(utcDay(new Date())), 60_000);
    inject(DestroyRef).onDestroy(() => clearInterval(clock));
    this.account.players
      .pipe(
        switchMap((player, index) => {
          if (index > 0) {
            this.switchTo(player);
          } else if (this.account.cloud) {
            this.moveDeviceProgress();
          }
          return this.storage.watch(PROGRESS_STORAGE_KEY);
        }),
        map(parseProgress),
        takeUntilDestroyed()
      )
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

  /**
   * Starts over for the next player, from what the storage tells of them -
   * nothing of the player before carries over, unless they played here as
   * a guest and signed in: then the guest's progress joins the account's,
   * once.
   */
  private switchTo({ adoptsGuest }: PlayerSwitch): void {
    const guest = this.progress();
    this.loaded.set(false);
    if (!adoptsGuest) {
      this.progress.set(EMPTY_PROGRESS);
      return;
    }
    this.storage.update(PROGRESS_STORAGE_KEY, (stored) =>
      adoptProgress(parseProgress(stored), guest)
    );
  }

  /**
   * Hands the progress this device kept before the game had the cloud - in
   * its own storage, under the same key - to the first player, once.
   */
  private moveDeviceProgress(): void {
    this.device
      .watch(PROGRESS_STORAGE_KEY)
      .pipe(take(1))
      .subscribe((stored) => {
        if (stored === null) {
          return;
        }
        const kept = parseProgress(stored);
        this.storage.update(PROGRESS_STORAGE_KEY, (account) =>
          adoptProgress(parseProgress(account), kept)
        );
        this.device.write(PROGRESS_STORAGE_KEY, null);
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
  public recordMatch(
    record: MatchRecord,
    { dailyDay = null, endlessWins = null }: MatchContext = {}
  ): MatchEarnings {
    const previousBest = this.medal(record.levelId, record.difficulty);
    const judged = judgeMatch(getLevel(record.levelId).medal, record);
    // The attempt was counted as the match started; past the attempts of the
    // day it is practice - judged on the stored attempts, not the ones here.
    const counts = (progress: Progress) =>
      dailyDay === null ||
      attemptsOn(progress.daily, dailyDay) <= DAILY_ATTEMPTS;
    const attempt =
      dailyDay === null ? 0 : attemptsOn(this.progress().daily, dailyDay);
    const practice = dailyDay !== null && !counts(this.progress());
    const { medal, hint } = practice
      ? { medal: null, hint: PRACTICE_HINT }
      : judged;
    const endless = endlessWins !== null;
    // Only the ladder's levels and the daily level keep a medallion: an
    // endless or a rolled level is new every time, there is no second go.
    const keepsMedal =
      !endless && (dailyDay !== null || isLadderLevel(record.levelId));
    const withMatch = (progress: Progress, medalCounts: boolean) => {
      const counted = addTotals(progress, {
        ...totalsOf(record),
        matchXp: matchXp(record),
      });
      return judged.medal === null || !medalCounts || !keepsMedal
        ? counted
        : addMedal(counted, record.levelId, record.difficulty, judged.medal);
    };
    const known = this.loaded();
    const earnings: MatchEarnings = {
      award: keepsMedal ? { record, medal, previousBest, hint } : null,
      ...this.record(
        (progress) =>
          endless ? addEndlessRun(progress, endlessWins) : progress,
        // The stored attempts decide; here, before the storage has told
        // them, a daily medallion waits for the stored progress to bring it.
        (progress) => withMatch(progress, counts(progress)),
        record,
        (progress) =>
          withMatch(progress, counts(progress) && (dailyDay === null || known))
      ),
    };
    // Before the storage has answered, which attempt it was is not known.
    return dailyDay === null || !this.loaded()
      ? earnings
      : {
          ...earnings,
          daily: {
            attempt,
            streak: standingStreak(this.progress().daily, dailyDay),
          },
        };
  }

  /** The most levels beaten in one endless run. */
  public readonly endlessBest = computed(() => this.progress().endlessBest);

  /**
   * Counts an attempt at the daily level of that UTC day as its match
   * starts - a match given up or restarted is an attempt all the same.
   */
  public startDailyAttempt(day: string): void {
    const count = (progress: Progress) => addDailyAttempt(progress, day);
    this.progress.update(count);
    this.store(this.progress(), count);
  }

  /** The UTC day, looked at again every minute - the daily level turns over. */
  private readonly today = signal(utcDay(new Date()));

  /** Today's daily level, its attempts left and the streak, for the menu. */
  public readonly daily = computed((): DailyOffer => {
    const day = this.today();
    const { daily } = this.progress();
    return {
      day,
      levelId: dailyLevelId(day),
      attemptsLeft: Math.max(0, DAILY_ATTEMPTS - attemptsOn(daily, day)),
      streak: standingStreak(daily, day),
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
    record: MatchRecord | null,
    /** The count as applied here, where it differs from the stored one. */
    countHere: (progress: Progress) => Progress = count
  ): Omit<MatchEarnings, 'award'> {
    const before = this.progress();
    const locksBefore = this.ladderLocks();
    const cosmeticsBefore = this.cosmeticLocks();
    const known = this.loaded();
    const { progress, earned } = earnAchievements(
      countHere(gain(before)),
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
    };
    this.storage.update(PROGRESS_STORAGE_KEY, (stored) =>
      mergeProgress(count(parseProgress(stored)), gains)
    );
  }
}

/**
 * Today as an ISO date in the player's time zone, "2026-10-19" - for the
 * day an achievement was earned. The daily level counts days in UTC
 * instead (`utcDay`), the same for everyone.
 */
function today(): string {
  const now = new Date();
  const two = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}`;
}
