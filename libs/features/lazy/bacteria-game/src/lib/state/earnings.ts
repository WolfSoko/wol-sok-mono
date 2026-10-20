import { AchievementId } from './achievement-ids';
import { MedalAward } from './medallions';
import { XpGain } from './xp';

/** Everything a match that has ended earned, for the result screen. */
export interface MatchEarnings {
  /** The medallion against the computer, null between two players. */
  award: MedalAward | null;
  achievements: readonly AchievementId[];
  xp: XpGain;
  /**
   * The XP before this match, for the bar to climb from - null when the
   * match ended before the storage told what was held.
   */
  xpBefore: number | null;
  /** The levels the match opened on the campaign ladder. */
  unlocked: readonly string[];
  /** The cosmetics the match opened, named - "Green colonies". */
  cosmetics: readonly string[];
  /** On the daily level: which attempt it was, and the streak after it. */
  daily?: DailyResult;
}

export interface DailyResult {
  /** The attempt of the day, from 1 - past `DAILY_ATTEMPTS` it is practice. */
  attempt: number;
  streak: number;
}
