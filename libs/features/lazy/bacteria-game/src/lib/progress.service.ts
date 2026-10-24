import {
  DestroyRef,
  Injectable,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { map, switchMap, take } from 'rxjs';
import { english, GameText } from './i18n/game-text';
import { BotDifficulty } from './state/bot-controller';
import { ladderLocks, newlyUnlocked } from './state/campaign';
import { getLevel, isLadderLevel } from './state/levels';
import { judgeMatch, MatchRecord, MedalTier } from './state/medallions';
import { earnAchievements } from './state/achievements';
import { MatchEarnings } from './state/earnings';
import { arenaLocks, colorLocks, newCosmeticTexts } from './state/unlocks';
import { COUCH_XP, matchXp, XpMatch, xpGain, xpOf } from './state/xp';
import {
  addMission,
  firstOpenMission,
  isMissionDone,
  Mission,
  missionResult,
  missionsDone,
  missionShortfall,
} from './state/training';
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
const PRACTICE_HINT_TEXT: GameText = {
  key: 'game.practice',
  params: { count: DAILY_ATTEMPTS },
};

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
    this.adopt(guest);
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
        this.adopt(parseProgress(stored));
        this.device.write(PROGRESS_STORAGE_KEY, null);
      });
  }

  /** Adds progress from elsewhere to the stored progress, once. */
  private adopt(progress: Progress): void {
    this.storage.update(PROGRESS_STORAGE_KEY, (stored) =>
      adoptProgress(parseProgress(stored), progress)
    );
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
    const { medal, hint, hintText } = practice
      ? {
          medal: null,
          hint: english(PRACTICE_HINT_TEXT),
          hintText: PRACTICE_HINT_TEXT,
        }
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
      award: keepsMedal
        ? { record, medal, previousBest, hint, hintText }
        : null,
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
        'couch'
      ),
    };
  }

  /** The wins between two players, by the winning colony's colour. */
  public readonly couchWins = computed(() => this.progress().couchWins);

  /**
   * Judges a training mission's match that has ended and remembers the
   * mission once it is done - its XP with it. It counts for nothing else:
   * no medallion, no totals, no achievements.
   */
  public recordTraining(record: MatchRecord, mission: Mission): MatchEarnings {
    const shortfall = missionShortfall(mission, record);
    const first =
      shortfall === null && !isMissionDone(this.training(), mission.id);
    const day = today();
    // Only a mission done the first time changes the progress: any other
    // match of one leaves it - and the storage - be.
    const earned = first
      ? this.record(
          (progress) => addMission(progress, mission.id, day),
          (progress) => progress,
          'training'
        )
      : {
          achievements: [],
          xp: { parts: [], total: 0 },
          xpBefore: this.loaded() ? this.xp() : null,
          unlocked: [],
          ...this.cosmetics([]),
        };
    return {
      award: null,
      ...earned,
      training: missionResult(mission.id, shortfall, first, this.training()),
    };
  }

  /** The day each training mission was done. */
  public readonly training = computed(() => this.progress().training);

  /** The training missions done so far. */
  public readonly missionsDone = computed(() => missionsDone(this.training()));

  /** The first training mission still to do - where the training picks up. */
  public readonly firstOpenMission = computed(() =>
    firstOpenMission(this.training())
  );

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
    match: XpMatch,
    /** The count as applied here, where it differs from the stored one. */
    countHere: (progress: Progress) => Progress = count
  ): Omit<MatchEarnings, 'award'> {
    // Only a match against the computer earns achievements of its own.
    const record = typeof match === 'string' ? null : match;
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
      xp: xpGain(before, progress, match),
      xpBefore: known ? xpOf(before) : null,
      unlocked: known
        ? newlyUnlocked(locksBefore, this.ladderLocks()).filter(
            (id) => id !== record?.levelId
          )
        : [],
      ...this.cosmetics(
        known ? newCosmeticTexts(cosmeticsBefore, this.cosmeticLocks()) : []
      ),
    };
  }

  /** The cosmetics a match opened, in English and to translate. */
  private cosmetics(
    texts: readonly GameText[]
  ): Pick<MatchEarnings, 'cosmetics' | 'cosmeticTexts'> {
    return { cosmetics: texts.map(english), cosmeticTexts: texts };
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
