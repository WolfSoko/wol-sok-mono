import { BotDifficulty, difficultyOption } from './bot-controller';
import { validColorPair } from './colony-colors';
import { TICKS_PER_SEC } from './fixed-tick';
import { BALANCE_VERSION } from './game-balance';
import { isObject } from './is-object';
import { isLevelId } from './levels';
import { isGameMode } from './game.states';
import { GhostController } from './ghost';
import { MatchEngine } from './match-engine';
import { MatchPlan, planMatch } from './match-setup';
import { Player } from './player.model';
import { isHeadStart } from './rivalry';
import { MatchOutcome } from './win-conditions';

/** The format of a replay - a new one for every change old ones cannot follow. */
export const REPLAY_VERSION = 1;

/** The biggest grid a replay may ask for, in cells per side. */
const MAX_GRID = 4096;
/** The longest match a replay may hold: an hour. */
const MAX_TICKS = 60 * 60 * TICKS_PER_SEC;

/** From this tick on, a human steers in the direction (x, y) - (0, 0) lets go. */
export type ReplaySteer = [
  tick: number,
  playerId: number,
  x: number,
  y: number,
];
/** Before this tick, a human sent the crosshair towards (x, y). */
export type ReplayDrag = [tick: number, playerId: number, x: number, y: number];
/** Before this tick, a human fired a boost. */
export type ReplayBoost = [tick: number, playerId: number];

/**
 * What the humans put in during a match, each input once, when it changed.
 * The crosshairs follow from it. The bot is not in it: it is derived from
 * the seed again.
 */
export interface ReplayInputs {
  steers: ReplaySteer[];
  drags: ReplayDrag[];
  boosts: ReplayBoost[];
}

export interface ReplayHeader extends MatchPlan {
  version: number;
  /** The balance table the match was played with - see `BALANCE_VERSION`. */
  balanceVersion: number;
  /**
   * Which simulation ran it. Only a match on the CPU one plays again the
   * same; the GPU one does not even agree with itself across devices.
   */
  simulation: 'cpu' | 'gpu';
  /** How many ticks the match lasted. */
  ticks: number;
}

/** A recorded match: how it was set up and what the humans did. */
export interface Replay {
  header: ReplayHeader;
  inputs: ReplayInputs;
}

/** A match played again from its replay. */
export interface ReplayResult {
  players: readonly Player[];
  /** How it ended - null when the recording stops before an outcome. */
  outcome: MatchOutcome | null;
  ticks: number;
}

/** The replay of a match played from `plan`, now that it is over. */
export function replayOf(
  plan: MatchPlan,
  simulation: ReplayHeader['simulation'],
  ticks: number,
  inputs: ReplayInputs
): Replay {
  return {
    header: {
      ...plan,
      version: REPLAY_VERSION,
      balanceVersion: BALANCE_VERSION,
      simulation,
      ticks,
    },
    inputs: {
      steers: inputs.steers.slice(),
      drags: inputs.drags.slice(),
      boosts: inputs.boosts.slice(),
    },
  };
}

/**
 * Plays a recorded match again on the CPU simulation, without anyone
 * watching. Null for a replay that would not play out as it was played:
 * another format, another balance table, or a match the GPU ran.
 */
export function playReplay(replay: Replay): ReplayResult | null {
  const { header, inputs } = replay;
  if (
    header.version !== REPLAY_VERSION ||
    header.balanceVersion !== BALANCE_VERSION ||
    header.simulation !== 'cpu'
  ) {
    return null;
  }
  const { spawns, options } = planMatch(header);
  // Every human is played back from the recording, as they were.
  const ghosts = new Map<number, GhostController>();
  spawns.forEach((spawn, seat) => {
    if (!spawn.isBot && spawn.neutral !== true) {
      ghosts.set(seat, new GhostController(inputs, seat));
    }
  });
  const engine = new MatchEngine(spawns, { ...options, ghosts });
  try {
    let outcome = engine.outcome();
    while (outcome == null && engine.tickCount < header.ticks) {
      engine.tick(header.width, header.height);
      outcome = engine.outcome();
    }
    return { players: engine.players, outcome, ticks: engine.tickCount };
  } finally {
    engine.dispose();
  }
}

/**
 * Reads a replay back from storage or a link. Null for anything that is not
 * a whole one - a replay with a damaged input could only play another match.
 */
export function parseReplay(value: unknown): Replay | null {
  if (!isObject(value) || !isObject(value['header'])) {
    return null;
  }
  const header = parseHeader(value['header']);
  const inputs = isObject(value['inputs']) ? value['inputs'] : null;
  if (header == null || inputs == null) {
    return null;
  }
  // Only the humans are recorded: the left seat, and the right one between
  // two players.
  const seats = header.mode === 'two-players' ? 2 : 1;
  const steers = inputList(inputs['steers'], 4, seats, header.ticks);
  const drags = inputList(inputs['drags'], 4, seats, header.ticks);
  const boosts = inputList(inputs['boosts'], 2, seats, header.ticks);
  if (steers == null || drags == null || boosts == null) {
    return null;
  }
  return {
    header,
    inputs: {
      steers: steers as ReplaySteer[],
      drags: drags as ReplayDrag[],
      boosts: boosts as ReplayBoost[],
    },
  };
}

function parseHeader(raw: Record<string, unknown>): ReplayHeader | null {
  const { levelId, mode, difficulty, headStart, simulation } = raw;
  const colors = validColorPair(raw['colors']);
  const [version, balanceVersion, width, height, seed, ticks] = [
    raw['version'],
    raw['balanceVersion'],
    raw['width'],
    raw['height'],
    raw['seed'],
    raw['ticks'],
  ];
  if (
    !isInteger(version) ||
    !isInteger(balanceVersion) ||
    !isInteger(width, 1, MAX_GRID) ||
    !isInteger(height, 1, MAX_GRID) ||
    !isInteger(seed) ||
    !isInteger(ticks, 0, MAX_TICKS) ||
    !isLevelId(levelId) ||
    !isGameMode(mode) ||
    difficultyOption(difficulty as BotDifficulty) == null ||
    colors == null ||
    !isHeadStart(headStart) ||
    (simulation !== 'cpu' && simulation !== 'gpu')
  ) {
    return null;
  }
  return {
    version,
    balanceVersion,
    simulation,
    ticks,
    levelId,
    mode,
    difficulty: difficulty as BotDifficulty,
    colors,
    headStart,
    width,
    height,
    seed,
  };
}

function isInteger(
  value: unknown,
  min = -Infinity,
  max = Infinity
): value is number {
  return (
    Number.isInteger(value) &&
    (value as number) >= min &&
    (value as number) <= max
  );
}

/**
 * The value as a list of inputs, each a tuple of this length that starts
 * with its tick and the seat of a human, in the order of the ticks - else
 * null.
 */
function inputList(
  value: unknown,
  length: number,
  seats: number,
  ticks: number
): number[][] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  let lastTick = 0;
  for (const entry of value) {
    if (
      !Array.isArray(entry) ||
      entry.length !== length ||
      !entry.every((n) => typeof n === 'number' && Number.isFinite(n)) ||
      !isInteger(entry[0], lastTick, ticks) ||
      !isInteger(entry[1], 0, seats - 1)
    ) {
      return null;
    }
    lastTick = entry[0];
  }
  return value as number[][];
}
