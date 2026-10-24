import { arenaSize, ONLINE_SIM_RESOLUTION } from './arena-size';
import { BotDifficulty, difficultyOption } from './bot-controller';
import { matchChecksum } from './checksum';
import { isDailyLevelId } from './daily';
import { isWeaponId, Loadout, parseGeneLevels } from './evolution';
import { validColorPair } from './colony-colors';
import { TICKS_PER_SEC } from './fixed-tick';
import { LADDER_VERSION } from './difficulty-curve';
import { BALANCE_VERSION } from './game-balance';
import { isInteger, isObject } from './is-object';
import { getLevel, isLevelId, levelSize } from './levels';
import { isGameMode } from './game-mode';
import { GhostController } from './ghost';
import {
  DRAG_STEPS,
  MatchEngine,
  SizeSample,
  STEER_STEPS,
} from './match-engine';
import { MatchPlan, planMatch } from './match-setup';
import { Player } from './player.model';
import { isHeadStart } from './rivalry';
import { EndReason, MatchOutcome } from './win-conditions';

/**
 * The format of a replay - a new one for every change old ones cannot follow.
 * Version 2 (ADR 0011) is the one that is stored and checked: CPU matches
 * only, with seats, outcome and checksum in the header. It is always plain:
 * no loadouts, no weapons fired - see {@link EVOLVED_REPLAY_VERSION}.
 */
export const REPLAY_VERSION = 2;

/**
 * The format of a replay with evolution in it (ADR 0013): version 2 plus
 * the seats' `loadouts` in the header and the weapons fired in the inputs.
 * A replay takes it only when loadouts change the match (a gene, a weapon,
 * or a boss they arm) or a weapon was fired; a plain match keeps version 2
 * or 1. A client or a server from before evolution would drop both and
 * play another match - with a version of its own, it refuses the replay
 * instead. Unlike version 2 it may come from a match the GPU ran, good for
 * a ghost race only, as version 1 is.
 */
export const EVOLVED_REPLAY_VERSION = 3;

/**
 * The format of a match against the ladder's computer (ADR 0016): version
 * 3 plus `ladder`, the version of the tables the computer played by - its
 * skill along the difficulty curve, its rules of play. A version 3 replay
 * played the difficulty's fixed computer, and plays it again; a client or
 * a server that knows only version 3 refuses this one instead of playing
 * the fixed computer against it.
 */
export const LADDER_REPLAY_VERSION = 4;

/**
 * The first format, still read for the ghost links in the wild - and still
 * written for a plain match the GPU ran, which version 2 does not take but
 * a ghost race can still play against. Always plain.
 */
export const GHOST_REPLAY_VERSION = 1;

/** What a version of the format may hold, and what it is good for. */
interface VersionRules {
  /** True when it may carry loadouts and weapons fired. */
  evolved: boolean;
  /** True when it is a match against the ladder's computer - and only then. */
  ladder: boolean;
  /** The simulations it may come from. */
  simulations: readonly ReplayHeader['simulation'][];
  /** True when `playReplay` plays it again - from the CPU only. */
  playable: boolean;
  /** True when the stored parse takes it - from the CPU only. */
  storable: boolean;
}

/** The rules of each version this client reads - see the versions above. */
const VERSIONS: ReadonlyMap<unknown, VersionRules> = new Map([
  [
    GHOST_REPLAY_VERSION,
    {
      evolved: false,
      ladder: false,
      simulations: ['cpu', 'gpu'],
      playable: false,
      storable: false,
    },
  ],
  [
    REPLAY_VERSION,
    {
      evolved: false,
      ladder: false,
      simulations: ['cpu'],
      playable: true,
      storable: true,
    },
  ],
  [
    EVOLVED_REPLAY_VERSION,
    {
      evolved: true,
      ladder: false,
      simulations: ['cpu', 'gpu'],
      playable: true,
      storable: true,
    },
  ],
  [
    LADDER_REPLAY_VERSION,
    {
      evolved: true,
      ladder: true,
      simulations: ['cpu', 'gpu'],
      playable: true,
      storable: true,
    },
  ],
]);

/**
 * True for a replay whose version may carry evolution - loadouts, weapons
 * fired, the ladder's computer (versions 3 and 4) - which the leaderboards
 * keep out of ranked attempts and the daily level (ADR 0013).
 */
export function isEvolvedReplay(
  header: Pick<ReplayHeader, 'version'>
): boolean {
  return VERSIONS.get(header.version)?.evolved === true;
}

/** The biggest grid a replay may ask for, in cells per side. */
const MAX_GRID = 4096;
/** The longest match a replay may hold: an hour. */
export const MAX_TICKS = 60 * 60 * TICKS_PER_SEC;
/**
 * The furthest a recorded push may reach along an axis: the stick and both
 * key sets of a single human add up to 3. The engine caps the push at unit
 * length when it moves the crosshair, so a longer one gains nothing.
 */
const MAX_STEER = 3;
/** The seats a match has - the left and the right colony. */
const SEATS = 2;

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
/** Before this tick, a human fired their weapon. */
export type ReplayWeapon = [tick: number, playerId: number];

/**
 * What the humans put in during a match, each input once, when it changed.
 * The crosshairs follow from it. The bot is not in it: it is derived from
 * the seed again.
 */
export interface ReplayInputs {
  steers: ReplaySteer[];
  drags: ReplayDrag[];
  boosts: ReplayBoost[];
  /** Empty in a replay from before the weapons - it plays as it did. */
  weapons: ReplayWeapon[];
}

/** Who played a seat - never who they are: no uids in a replay. */
export interface ReplaySeat {
  isBot: boolean;
}

/** How the match ended as the recording device saw it. */
export interface ReplayOutcome {
  endedBy: EndReason;
  /** The seat that won, null for a draw. */
  winnerSeat: number | null;
}

/** The ranked attempt a match was declared as (ADR 0012) - checked, never trusted. */
export interface ReplayAttempt {
  id: string;
  /** When the server took the declaration, in ms since the epoch. */
  at: number;
}

/**
 * How a replay was played: the effective plan and what came of it. The
 * fields after `ticks` are version 2's; a version 1 header has none of them.
 * The seats' `loadouts` (from the plan) only a version 3 or 4 header has:
 * absent for plain colonies, as in every replay of a plain match - and
 * `ladder` only a version 4 one.
 */
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
  /** Version 2: who played each seat, the left one first. */
  seats?: ReplaySeat[];
  /** Version 2, online only: the room the match was played in... */
  roomCode?: string;
  /** ...and its number there - with the seed, the match's id. */
  n?: number;
  /** Version 2: how it ended, as the recording device saw it. */
  outcome?: ReplayOutcome;
  /** Version 2: the {@link matchChecksum} after the last tick. */
  checksum?: number;
  /** Version 2: the app version that recorded it - never shown. */
  client?: string;
  /** Version 2: the ranked attempt the match was declared as. */
  attempt?: ReplayAttempt;
}

/** A recorded match: how it was set up and what the humans did. */
export interface Replay {
  header: ReplayHeader;
  inputs: ReplayInputs;
}

/** What a version 2 header holds beyond the plan, the simulation and the ticks. */
export type ReplayExtras = Pick<
  ReplayHeader,
  'seats' | 'roomCode' | 'n' | 'outcome' | 'checksum' | 'client' | 'attempt'
>;

/** A match played again from its replay. */
export interface ReplayResult {
  players: readonly Player[];
  /** How it ended - null when the recording stops before an outcome. */
  outcome: MatchOutcome | null;
  ticks: number;
  /** The {@link matchChecksum} after the last tick played. */
  checksum: number;
  /** The colony sizes by seat after every full second - see `onSecond`. */
  samples: SizeSample[];
}

/**
 * The replay of a match played from `plan`, now that it is over. For an
 * online match `plan` is the effective one - two players, no head start -
 * and `extras` carries the room and the outcome. A plain match the GPU ran
 * gets a version 1 header, good for a ghost race only. A match with
 * evolution in it takes {@link EVOLVED_REPLAY_VERSION} on either
 * simulation - {@link LADDER_REPLAY_VERSION} against the ladder's computer;
 * a plain one is written without loadouts, which change nothing in it.
 *
 * Whether evolution played a part is `planMatch`'s word (`evolved`): only
 * it knows that a ghost race has no boss to arm. Without a ghost it can be
 * asked again from the plan alone.
 */
export function replayOf(
  plan: MatchPlan,
  simulation: ReplayHeader['simulation'],
  ticks: number,
  inputs: ReplayInputs,
  extras: ReplayExtras = {},
  evolved: boolean = planMatch(plan).evolved
): Replay {
  const { loadouts: _loadouts, ladder: _ladder, ...plain } = plan;
  const base = {
    ...(evolved ? plan : plain),
    balanceVersion: BALANCE_VERSION,
    simulation,
    ticks,
  };
  const header: ReplayHeader =
    simulation === 'cpu' || evolved
      ? {
          ...base,
          version: !evolved
            ? REPLAY_VERSION
            : plan.ladder === undefined
              ? EVOLVED_REPLAY_VERSION
              : LADDER_REPLAY_VERSION,
          seats: extras.seats ?? seatsOf(plan.mode),
          ...definedOnly({
            roomCode: extras.roomCode,
            n: extras.n,
            outcome: extras.outcome,
            checksum: extras.checksum,
            client: extras.client,
            attempt: extras.attempt,
          }),
        }
      : { ...base, version: GHOST_REPLAY_VERSION };
  return {
    header,
    inputs: {
      steers: inputs.steers.slice(),
      drags: inputs.drags.slice(),
      boosts: inputs.boosts.slice(),
      weapons: inputs.weapons.slice(),
    },
  };
}

/** A match's outcome as a replay header keeps it. */
export function replayOutcome(
  outcome: MatchOutcome | null
): ReplayOutcome | null {
  return outcome === null
    ? null
    : { endedBy: outcome.reason, winnerSeat: outcome.winner?.id ?? null };
}

/**
 * Plays a recorded match again on the CPU simulation, without anyone
 * watching. Null for a replay that would not play out as it was played:
 * another format (versions 2 to 4 play), another balance table, another
 * ladder computer, or a match the GPU ran.
 */
export function playReplay(replay: Replay): ReplayResult | null {
  const { header, inputs } = replay;
  if (
    VERSIONS.get(header.version)?.playable !== true ||
    header.balanceVersion !== BALANCE_VERSION ||
    (header.ladder !== undefined && header.ladder !== LADDER_VERSION) ||
    header.simulation !== 'cpu'
  ) {
    return null;
  }
  const samples: SizeSample[] = [];
  const { spawns, options } = planMatch(header);
  // Every human is played back from the recording, as they were.
  const ghosts = new Map<number, GhostController>();
  spawns.forEach((spawn, seat) => {
    const isBot = header.seats?.[seat]?.isBot ?? spawn.isBot;
    if (!isBot && spawn.neutral !== true) {
      ghosts.set(seat, new GhostController(inputs, seat));
    }
  });
  const engine = new MatchEngine(spawns, {
    ...options,
    ghosts,
    onSecond: (sizes) => samples.push(sizes),
  });
  try {
    let outcome = engine.outcome();
    while (outcome == null && engine.tickCount < header.ticks) {
      engine.tick(header.width, header.height);
      outcome = engine.outcome();
    }
    return {
      players: engine.players,
      outcome,
      ticks: engine.tickCount,
      checksum: matchChecksum(engine.players),
      samples,
    };
  } finally {
    engine.dispose();
  }
}

/** How strict {@link parseReplay} is. */
export interface ParseOptions {
  /**
   * True for a replay to store and check (ADR 0011): version 2, 3 or 4
   * from the CPU, on the online grid of its level, with its outcome and
   * checksum - an evolved one (3, 4) never for a ranked attempt or the
   * daily level (ADR 0013).
   */
  stored?: boolean;
}

/**
 * Reads a replay back from storage or a link. Null for anything that is not
 * a whole one - a replay with a damaged input could only play another match.
 * Version 1 replays are read as they always were, for ghost races; version 2
 * is strict about what a recording can hold, and version 3 as strict about
 * its loadouts and weapons. Versions 1 and 2 must carry neither.
 */
export function parseReplay(
  value: unknown,
  options: ParseOptions = {}
): Replay | null {
  if (
    !isObject(value) ||
    !isObject(value['header']) ||
    !isObject(value['inputs'])
  ) {
    return null;
  }
  const raw = value['header'];
  const inputs = value['inputs'];
  const stored = options.stored === true;
  const rules = VERSIONS.get(raw['version']);
  if (rules === undefined || (stored && !rules.storable)) {
    return null;
  }
  const replay =
    raw['version'] === GHOST_REPLAY_VERSION
      ? parseGhostReplay(raw, inputs)
      : parseStrictReplay(raw, inputs, stored);
  return replay !== null && fitsVersion(replay, rules, stored) ? replay : null;
}

/**
 * True when a replay holds only what its version may: a simulation it may
 * come from - the CPU for one to store - and, for a plain version, no
 * loadouts and no weapons fired: every client before evolution would drop
 * them and play another match. An evolved one never belongs to a ranked
 * attempt or the daily level, which the leaderboards keep plain (ADR 0013).
 */
function fitsVersion(
  { header, inputs }: Replay,
  rules: VersionRules,
  stored: boolean
): boolean {
  return (
    rules.simulations.includes(header.simulation) &&
    (!stored || header.simulation === 'cpu') &&
    (rules.evolved
      ? header.attempt === undefined && !isDailyLevelId(header.levelId)
      : header.loadouts === undefined && inputs.weapons.length === 0) &&
    // The ladder's computer plays where loadouts do: against the computer.
    (rules.ladder
      ? header.ladder !== undefined &&
        header.loadouts !== undefined &&
        header.mode === 'vs-computer'
      : header.ladder === undefined)
  );
}

/** A version 2 or 3 replay, strict about what a recording can hold. */
function parseStrictReplay(
  raw: Record<string, unknown>,
  inputs: Record<string, unknown>,
  stored: boolean
): Replay | null {
  const header = parseHeaderV2(raw, stored);
  if (header == null) {
    return null;
  }
  const humans = (header.seats ?? []).map(({ isBot }) => !isBot);
  const steers = strictInputs(inputs['steers'], 4, header, humans, steerAt);
  const drags = strictInputs(inputs['drags'], 4, header, humans, dragAt);
  const boosts = strictInputs(inputs['boosts'], 2, header, humans, () => true);
  // A plain replay has no list of weapons: none were fired.
  const weapons = strictInputs(
    inputs['weapons'] ?? [],
    2,
    header,
    humans,
    () => true
  );
  if (steers == null || drags == null || boosts == null || weapons == null) {
    return null;
  }
  return {
    header,
    inputs: {
      steers: steers as ReplaySteer[],
      drags: drags as ReplayDrag[],
      boosts: boosts as ReplayBoost[],
      weapons: weapons as ReplayWeapon[],
    },
  };
}

/** A version 1 replay, read as it always was. */
function parseGhostReplay(
  raw: Record<string, unknown>,
  inputs: Record<string, unknown>
): Replay | null {
  const header = parsePlan(raw);
  if (header == null) {
    return null;
  }
  // Only the humans are recorded: the left seat, and the right one between
  // two players.
  const seats = header.mode === 'two-players' ? 2 : 1;
  const steers = inputList(inputs['steers'], 4, seats, header.ticks);
  const drags = inputList(inputs['drags'], 4, seats, header.ticks);
  const boosts = inputList(inputs['boosts'], 2, seats, header.ticks);
  // A replay from before the weapons has none.
  const weapons = inputList(inputs['weapons'] ?? [], 2, seats, header.ticks);
  if (steers == null || drags == null || boosts == null || weapons == null) {
    return null;
  }
  return {
    header,
    inputs: {
      steers: steers as ReplaySteer[],
      drags: drags as ReplayDrag[],
      boosts: boosts as ReplayBoost[],
      weapons: weapons as ReplayWeapon[],
    },
  };
}

/**
 * The fields every version has - null where one is missing or broken - and
 * the seats' loadouts, where it has them.
 */
function parsePlan(raw: Record<string, unknown>): ReplayHeader | null {
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
  const loadouts = parseLoadouts(raw['loadouts']);
  const ladder = raw['ladder'];
  if (loadouts === null || (ladder !== undefined && !isInteger(ladder, 1))) {
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
    ...(loadouts === undefined ? {} : { loadouts }),
    ...(ladder === undefined ? {} : { ladder }),
  };
}

/**
 * The seats' loadouts of a header: undefined where it has none - plain
 * colonies - and null where they are damaged. Unlike a stored loadout,
 * which keeps what it can, a damaged one could only play another match.
 */
function parseLoadouts(
  value: unknown
): readonly [Loadout, Loadout] | undefined | null {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value) || value.length !== 2) {
    return null;
  }
  const [left, right] = value.map(strictLoadout);
  return left === null || right === null ? null : [left, right];
}

/** A loadout exactly as written, null for anything else. */
function strictLoadout(value: unknown): Loadout | null {
  if (!isObject(value)) {
    return null;
  }
  const { genes, weapon } = value;
  const levels = parseGeneLevels(genes, { strict: true });
  return levels === null || (weapon !== null && !isWeaponId(weapon))
    ? null
    : { genes: levels, weapon };
}

const ROOM_CODE = /^[A-Z0-9]{4,16}$/;
const CLIENT = /^[\w.-]{1,32}$/;
const ATTEMPT_ID = /^[\w-]{1,64}$/;
const END_REASONS: readonly EndReason[] = [
  'annihilation',
  'time',
  'hold',
  'survive',
  'harvest',
  'forfeit',
  'desync',
];

/**
 * A version 2 or 3 header - null for anything a recording cannot hold. What
 * its version allows on top is {@link fitsVersion}'s to check.
 */
function parseHeaderV2(
  raw: Record<string, unknown>,
  stored: boolean
): ReplayHeader | null {
  const plan = parsePlan(raw);
  if (plan == null) {
    return null;
  }
  const seats = parseSeats(raw['seats'], plan.mode);
  if (seats == null) {
    return null;
  }
  const header: ReplayHeader = { ...plan, seats };
  const { roomCode, n, outcome, checksum, client, attempt } = raw;
  if (roomCode !== undefined || n !== undefined) {
    // Online: both or neither, between two players without a head start.
    if (
      typeof roomCode !== 'string' ||
      !ROOM_CODE.test(roomCode) ||
      !isInteger(n, 0, 1_000_000) ||
      plan.mode !== 'two-players' ||
      plan.headStart !== 0
    ) {
      return null;
    }
    header.roomCode = roomCode;
    header.n = n;
  }
  if (outcome !== undefined) {
    const parsed = parseOutcome(outcome);
    if (parsed == null) {
      return null;
    }
    header.outcome = parsed;
  }
  if (checksum !== undefined) {
    if (!isInteger(checksum, 0, 0xffffffff)) {
      return null;
    }
    header.checksum = checksum;
  }
  if (client !== undefined) {
    if (typeof client !== 'string' || !CLIENT.test(client)) {
      return null;
    }
    header.client = client;
  }
  if (attempt !== undefined) {
    if (
      !isObject(attempt) ||
      typeof attempt['id'] !== 'string' ||
      !ATTEMPT_ID.test(attempt['id']) ||
      !isInteger(attempt['at'], 0)
    ) {
      return null;
    }
    header.attempt = { id: attempt['id'], at: attempt['at'] };
  }
  if (stored) {
    const grid = arenaSize(
      ONLINE_SIM_RESOLUTION,
      levelSize(getLevel(plan.levelId))
    );
    if (
      plan.width !== grid.width ||
      plan.height !== grid.height ||
      header.outcome === undefined ||
      header.checksum === undefined
    ) {
      return null;
    }
  }
  return header;
}

/** The seats of a match in that mode: against the computer, the right is a bot. */
function seatsOf(mode: MatchPlan['mode']): ReplaySeat[] {
  return [{ isBot: false }, { isBot: mode === 'vs-computer' }];
}

/** The seats as stored, null unless they are the seats of `mode`. */
function parseSeats(
  value: unknown,
  mode: MatchPlan['mode']
): ReplaySeat[] | null {
  const expected = seatsOf(mode);
  if (
    !Array.isArray(value) ||
    value.length !== SEATS ||
    !value.every(
      (seat, index) => isObject(seat) && seat['isBot'] === expected[index].isBot
    )
  ) {
    return null;
  }
  return expected;
}

function parseOutcome(value: unknown): ReplayOutcome | null {
  if (!isObject(value)) {
    return null;
  }
  const { endedBy, winnerSeat } = value;
  if (
    !END_REASONS.includes(endedBy as EndReason) ||
    (winnerSeat !== null && !isInteger(winnerSeat, 0, SEATS - 1))
  ) {
    return null;
  }
  return { endedBy: endedBy as EndReason, winnerSeat };
}

/** True for a push on the steering grid, within reach. */
function steerAt(x: number, y: number): boolean {
  return [x, y].every(
    (v) => Number.isInteger(v * STEER_STEPS) && Math.abs(v) <= MAX_STEER
  );
}

/** True for a drag target on the drag grid, inside the arena. */
function dragAt(x: number, y: number, header: ReplayHeader): boolean {
  return (
    Number.isInteger(x * DRAG_STEPS) &&
    Number.isInteger(y * DRAG_STEPS) &&
    x >= 0 &&
    x <= header.width &&
    y >= 0 &&
    y <= header.height
  );
}

/**
 * A version 2 list of inputs - else null. Each entry is a tuple of this
 * length: its tick, a human's seat, and values `valid` takes. The ticks go
 * up through the list, and strictly per seat: the recorder keeps one input
 * of a kind per seat and tick.
 */
function strictInputs(
  value: unknown,
  length: number,
  header: ReplayHeader,
  humans: readonly boolean[],
  valid: (x: number, y: number, header: ReplayHeader) => boolean
): number[][] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  let lastTick = 0;
  const lastBySeat = humans.map(() => -1);
  for (const entry of value) {
    if (
      !Array.isArray(entry) ||
      entry.length !== length ||
      !entry.every((n) => typeof n === 'number' && Number.isFinite(n)) ||
      !isInteger(entry[0], lastTick, header.ticks) ||
      !isInteger(entry[1], 0, humans.length - 1) ||
      !humans[entry[1]] ||
      entry[0] <= lastBySeat[entry[1]] ||
      (length === 4 && !valid(entry[2], entry[3], header))
    ) {
      return null;
    }
    lastTick = entry[0];
    lastBySeat[entry[1]] = entry[0];
  }
  return value as number[][];
}

/**
 * The value as a list of version 1 inputs, each a tuple of this length that
 * starts with its tick and the seat of a human, in the order of the ticks -
 * else null.
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

/** The object without its undefined fields. */
function definedOnly<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, field]) => field !== undefined)
  ) as Partial<T>;
}
