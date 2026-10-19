import { scaleOf } from './arena-size';
import { BotDifficulty } from './bot-controller';
import { getColonyColor, toPlayerColor } from './colony-colors';
import type { GameMode } from './game.states';
import {
  getLevel,
  levelBalance,
  levelCrosshairSpeed,
  levelMap,
} from './levels';
import { MatchOptions, PlayerSpawn } from './match-engine';
import { HeadStart, startScales } from './rivalry';

/**
 * Everything a match is derived from. The same plan spawns the same
 * colonies on the same map with the same rules and the same seed - which is
 * what a replay keeps in its header.
 */
export interface MatchPlan {
  levelId: string;
  mode: GameMode;
  difficulty: BotDifficulty;
  /** The colour ids of the left and the right colony. */
  colors: [string, string];
  headStart: HeadStart;
  /** The simulation grid, in cells. */
  width: number;
  height: number;
  seed: number;
}

/**
 * The players and the rules of a planned match.
 *
 * In `vs-computer` mode the second crosshair belongs to the bot, and the
 * names change with it so the scoreboard reads "You" and "Computer".
 * Between two players each one is called by their colour.
 */
export function planMatch(plan: MatchPlan): {
  spawns: PlayerSpawn[];
  options: MatchOptions;
} {
  const { width, height, mode } = plan;
  const level = getLevel(plan.levelId);
  const scale = scaleOf(width);
  const versusComputer = mode === 'vs-computer';
  const [left, right] = plan.colors.map(getColonyColor);
  const [leftScale, rightScale] = versusComputer
    ? [1, 1]
    : startScales(plan.headStart);
  return {
    spawns: [
      {
        x: width / 4,
        y: height / 2,
        color: toPlayerColor(left),
        name: versusComputer ? 'You' : left.name,
        isBot: false,
        startScale: leftScale,
      },
      {
        x: (width / 4) * 3,
        y: height / 2,
        color: toPlayerColor(right),
        name: versusComputer ? 'Computer' : right.name,
        isBot: versusComputer,
        startScale: rightScale,
      },
    ],
    options: {
      balance: levelBalance(level, scale),
      map: levelMap(level),
      crosshairSpeed: levelCrosshairSpeed(level, scale),
      difficulty: plan.difficulty,
      arena: { width, height },
      seed: plan.seed,
    },
  };
}
