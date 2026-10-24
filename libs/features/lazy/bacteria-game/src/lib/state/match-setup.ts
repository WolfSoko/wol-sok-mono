import {
  evolvedTraits,
  isPlainLoadout,
  Loadout,
  PLAIN_LOADOUT,
} from './evolution';
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
import { GhostController, NO_INPUT, SeatDriver, turnedOnto } from './ghost';
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
  /**
   * What each seat evolved - see `evolution.ts`. Plain when absent, as in
   * every match that is not against the computer on the ladder or a
   * generated level. Only a match against the computer plays them - not
   * one between two players or online. Against a ghost only the left
   * seat's counts: the ghost plays with the loadout its run recorded. With
   * them, a boss carries its weapon too: a match without them plays as it
   * did before there was evolution, which keeps its replays.
   */
  loadouts?: readonly [Loadout, Loadout];
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
 * `ghost` the second colony plays that recorded run instead of a bot. On a
 * level played against a dummy (`opponent`) it is the training dummy,
 * which nobody steers.
 *
 * `online` makes it a match between two devices, played between two players
 * without a head start: the other device's seat spawns as a bot, as the
 * ghost does - the game treats it as nobody at this screen - and the
 * lockstep drives both seats.
 *
 * `evolved` says whether evolution plays a part: a seat carries a weapon or
 * genes that change its traits - what decides the replay's version.
 */
export function planMatch(
  plan: MatchPlan,
  ghost: Replay | null = null,
  online: OnlineSeats | null = null
): PlannedMatch {
  if (online !== null) {
    return planOnline(plan, online);
  }
  const { width, height, mode } = plan;
  const level = getLevel(plan.levelId);
  const boss = ghost === null ? level.boss : undefined;
  const scale = gridScale(level, width);
  const versusComputer = mode === 'vs-computer';
  const dummy = ghost === null && versusComputer && level.opponent === 'dummy';
  const [left, right] = plan.colors.map(getColonyColor);
  const [leftScale, rightScale] = versusComputer
    ? [1, 1]
    : startScales(plan.headStart);
  const [leftSpot, rightSpot] = spawnSpots(width, height);
  const loadouts = !versusComputer
    ? null
    : ghost === null
      ? (plan.loadouts ?? null)
      : ghostLoadouts(plan, ghost);
  return {
    evolved:
      loadouts !== null &&
      (!loadouts.every(isPlainLoadout) || boss?.weapon != null),
    spawns: [
      {
        ...leftSpot,
        color: toPlayerColor(left),
        name: versusComputer ? 'You' : left.name,
        isBot: false,
        startScale: leftScale,
        ...(loadouts === null
          ? {}
          : {
              traits: evolvedTraits(loadouts[0]),
              weapon: loadouts[0].weapon,
            }),
      },
      {
        ...rightSpot,
        color: toPlayerColor(right),
        name:
          ghost !== null
            ? 'Ghost'
            : dummy
              ? 'Dummy'
              : versusComputer
                ? 'Computer'
                : right.name,
        isBot: versusComputer,
        // The boss plays from the right seat - BOSS_SEAT - whoever steers
        // it. Not a ghost: it replays a run played from the left seat.
        startScale: rightScale * (boss?.startScale ?? 1),
        traits:
          loadouts === null
            ? boss?.traits
            : evolvedTraits(loadouts[1], boss?.traits),
        ...(loadouts === null
          ? {}
          : { weapon: loadouts[1].weapon ?? boss?.weapon ?? null }),
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
          ? dummy
            ? new Map([[1, IDLE_SEAT]])
            : undefined
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
 * The seats' loadouts in a race against a ghost: the left one the human's,
 * as against the computer; the ghost the one its run was played with from
 * the left seat - plain where the run recorded none. Null when neither has
 * one, which plays as a race did before evolution.
 */
function ghostLoadouts(
  plan: MatchPlan,
  ghost: Replay
): readonly [Loadout, Loadout] | null {
  const human = plan.loadouts?.[0];
  const recorded = ghost.header.loadouts?.[0];
  return human === undefined && recorded === undefined
    ? null
    : [human ?? PLAIN_LOADOUT, recorded ?? PLAIN_LOADOUT];
}

/**
 * A seat nobody steers: a training dummy sits where it spawned - its
 * bacteria still divide and fight back where they are attacked.
 */
const IDLE_SEAT: SeatDriver = { before: () => NO_INPUT };

/** The players and the rules of a planned match - see {@link planMatch}. */
export interface PlannedMatch {
  spawns: PlayerSpawn[];
  options: MatchOptions;
  /** True when a seat carries a weapon or genes that change its traits. */
  evolved: boolean;
}

/** The seats of an online match - both players. */
const ONLINE_SEATS: ReadonlySet<number> = new Set([0, 1]);

function planOnline(plan: MatchPlan, online: OnlineSeats): PlannedMatch {
  // Online plays plain: what one device evolved, the other cannot check.
  const { spawns, options } = planMatch({
    ...plan,
    mode: 'two-players',
    headStart: 0,
    loadouts: undefined,
  });
  return {
    evolved: false,
    spawns: spawns.map((spawn, seat) =>
      spawn.neutral === true
        ? spawn
        : {
            ...spawn,
            name: seat === online.seat ? 'You' : 'Opponent',
            isBot: seat !== online.seat,
          }
    ),
    // Both seats are recorded: the replay plays them both back (ADR 0011).
    options: {
      ...options,
      ghosts: online.drivers,
      recordedSeats: ONLINE_SEATS,
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
