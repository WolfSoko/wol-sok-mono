import { AchievementId } from './achievement-ids';
import { MedalAward } from './medallions';
import { XpGain } from './xp';

/** Everything a match that has ended earned, for the result screen. */
export interface MatchEarnings {
  /** The medallion against the computer, null between two players. */
  award: MedalAward | null;
  achievements: readonly AchievementId[];
  xp: XpGain;
  /** The XP before this match, for the bar to climb from. */
  xpBefore: number;
  /** The levels the match opened on the campaign ladder. */
  unlocked: readonly string[];
}
