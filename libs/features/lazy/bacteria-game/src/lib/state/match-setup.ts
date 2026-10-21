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
import { GhostController, turnedOnto } from './ghost';
import { HeadStart, startScales } from './rivalry';
import { spawnSpots } from './shapes';
import type { Replay } from './replay';
import { winRuleOf } from './win-conditions';

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
 * Between two players each one is called by their colour. Against a
 * `ghost` the second colony plays that recorded run instead of a bot.
 */
export function planMatch(
  plan: MatchPlan,
  ghost: Replay | null = null
): {
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
  const [leftSpot, rightSpot] = spawnSpots(width, height);
  return {
    spawns: [
      {
        ...leftSpot,
        color: toPlayerColor(left),
        name: versusComputer ? 'You' : left.name,
        isBot: false,
        startScale: leftScale,
      },
      {
        ...rightSpot,
        color: toPlayerColor(right),
        name:
          ghost !== null ? 'Ghost' : versusComputer ? 'Computer' : right.name,
        isBot: versusComputer,
        // The boss is the right colony, whoever steers it.
        startScale: rightScale * (level.boss?.startScale ?? 1),
        traits: level.boss?.traits,
      },
    ],
    options: {
      balance: levelBalance(level, scale),
      map: levelMap(level),
      crosshairSpeed: levelCrosshairSpeed(level, scale),
      difficulty: plan.difficulty,
      arena: { width, height },
      seed: plan.seed,
      win: winRuleOf(level),
      // The run was played from the left: the ghost plays it from the right.
      ghosts:
        ghost === null
          ? undefined
          : new Map([
              [
                1,
                new GhostController(
                  ghost.inputs,
                  0,
                  turnedOnto(ghost.header, { width, height })
                ),
              ],
            ]),
    },
  };
}
