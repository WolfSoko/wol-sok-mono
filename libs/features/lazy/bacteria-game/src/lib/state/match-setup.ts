import { BotDifficulty } from './bot-controller';
import { getColonyColor, NEUTRAL_COLOR, toPlayerColor } from './colony-colors';
import { NEUTRAL_TRAITS } from './game-balance';
import type { GameMode } from './game-mode';
import {
  getLevel,
  gridScale,
  levelBalance,
  levelCrosshairSpeed,
  levelMap,
} from './levels';
import { MatchOptions, PlayerSpawn } from './match-engine';
import { GhostController, SeatDriver, turnedOnto } from './ghost';
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

/** The seat of the player at this device in an online match, and its drivers. */
export interface OnlineSeats {
  seat: 0 | 1;
  /** What plays both seats - the lockstep of the two devices. */
  drivers: ReadonlyMap<number, SeatDriver>;
}

/**
 * The players and the rules of a planned match.
 *
 * In `vs-computer` mode the second crosshair belongs to the bot, and the
 * names change with it so the scoreboard reads "You" and "Computer".
 * Between two players each one is called by their colour. Against a
 * `ghost` the second colony plays that recorded run instead of a bot.
 *
 * `online` makes it a match between two devices, played between two players
 * without a head start: the other device's seat spawns as a bot, as the
 * ghost does - the game treats it as nobody at this screen - and the
 * lockstep drives both seats.
 */
export function planMatch(
  plan: MatchPlan,
  ghost: Replay | null = null,
  online: OnlineSeats | null = null
): {
  spawns: PlayerSpawn[];
  options: MatchOptions;
} {
  if (online !== null) {
    return planOnline(plan, online);
  }
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

function planOnline(
  plan: MatchPlan,
  online: OnlineSeats
): ReturnType<typeof planMatch> {
  const { spawns, options } = planMatch({
    ...plan,
    mode: 'two-players',
    headStart: 0,
  });
  return {
    spawns: spawns.map((spawn, seat) =>
      spawn.neutral === true
        ? spawn
        : {
            ...spawn,
            name: seat === online.seat ? 'You' : 'Opponent',
            isBot: seat !== online.seat,
          }
    ),
    options: { ...options, ghosts: online.drivers },
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
