import { BotDifficulty } from './bot-controller';
import { getColonyColor, NEUTRAL_COLOR, toPlayerColor } from './colony-colors';
import { NEUTRAL_TRAITS } from './game-balance';
import type { GameMode } from './game.states';
import {
  getLevel,
  gridScale,
  levelBalance,
  levelCrosshairSpeed,
  levelMap,
} from './levels';
import { MatchOptions, PlayerSpawn } from './match-engine';
import { GhostController, turnedOnto } from './ghost';
import { HeadStart, startScales } from './rivalry';
import { spawnSpots } from './shapes';
import type { Replay } from './replay';
import { WinRule, winRuleOf } from './win-conditions';

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
  const boss = ghost === null ? level.boss : undefined;
  const scale = gridScale(level, width);
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
        // The boss plays from the right seat - BOSS_SEAT - whoever steers
        // it. Not a ghost: it replays a run played from the left seat.
        startScale: rightScale * (boss?.startScale ?? 1),
        traits: boss?.traits,
        boss: boss !== undefined,
      },
      // After the players: nobody steers them, so no seat is theirs.
      ...(level.neutrals ?? []).map((spot): PlayerSpawn => ({
        x: Math.round(spot.x * width),
        y: Math.round(spot.y * height),
        color: NEUTRAL_COLOR,
        name: 'Neutral',
        isBot: false,
        startScale: spot.startScale,
        traits: NEUTRAL_TRAITS,
        neutral: true,
      })),
    ],
    options: {
      balance: levelBalance(level, scale),
      map: levelMap(level),
      crosshairSpeed: levelCrosshairSpeed(level, scale),
      difficulty: plan.difficulty,
      arena: { width, height },
      seed: plan.seed,
      win: ghostRace(winRuleOf(level), ghost),
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

/**
 * The rule of a race against a ghost: the level's, but a survive level's
 * clock decides by size - there is no boss in the race to survive.
 */
function ghostRace(rule: WinRule, ghost: Replay | null): WinRule {
  return ghost !== null && rule.kind === 'survive'
    ? { kind: 'timed', limitSec: rule.limitSec }
    : rule;
}
