import { BotDifficulty } from './bot-controller';
import { MatchRecord } from './medallions';
import { Player } from './player.model';

/**
 * Follows a match against the computer frame by frame and keeps what its
 * medallion is judged on but the last frame no longer shows: the boosts the
 * human fired, the colony's peak and how far it fell behind.
 */
export class MatchTally {
  private boostsFired = 0;
  private peakCount = 0;
  private lowestSizeRatio = 1;

  /**
   * Takes one frame in: the players as they stand after it, and the boosts
   * fired during it - true for the computer's.
   */
  public frame(players: readonly Player[], boosts: readonly boolean[]): void {
    this.boostsFired += boosts.filter((isBot) => !isBot).length;
    const [human, bot] = sides(players);
    if (human == null || bot == null) {
      return;
    }
    this.peakCount = Math.max(this.peakCount, human.bacteriaCount);
    // A colony that is gone has no size to compare: that is the result.
    if (human.bacteriaCount > 0 && bot.bacteriaCount > 0) {
      this.lowestSizeRatio = Math.min(
        this.lowestSizeRatio,
        human.bacteriaCount / bot.bacteriaCount
      );
    }
  }

  /** What the match measured, once it is over. */
  public record(
    players: readonly Player[],
    match: {
      levelId: string;
      difficulty: BotDifficulty;
      winner: Player | null;
      durationSec: number;
    }
  ): MatchRecord {
    const [human] = sides(players);
    return {
      levelId: match.levelId,
      difficulty: match.difficulty,
      won: match.winner != null && !match.winner.isBot,
      durationSec: match.durationSec,
      boostsFired: this.boostsFired,
      lost: human?.lost ?? 0,
      peakCount: this.peakCount,
      lowestSizeRatio: this.lowestSizeRatio,
    };
  }
}

/** The human's and the computer's player. */
function sides(
  players: readonly Player[]
): [Player | undefined, Player | undefined] {
  return [
    players.find((player) => !player.isBot),
    players.find((player) => player.isBot),
  ];
}
