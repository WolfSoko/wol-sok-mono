import { validColorPair } from '../state/colony-colors';
import { BALANCE_VERSION } from '../state/game-balance';
import { isObject } from '../state/is-object';
import { isLevelId } from '../state/levels';

/**
 * The version of what two devices say to each other - a new one for every
 * change an older game could not follow. Both sides also need the same
 * balance table, or the same inputs play another match.
 */
export const NET_VERSION = `1/${BALANCE_VERSION}`;

/** What one seat puts in before one tick, on the engine's input grid. */
export interface TickInput {
  /** Where the stick and the keys push - (0, 0) at rest. */
  steer: [x: number, y: number];
  /** Where a finger sent the crosshair since the last tick, if anywhere. */
  drag: [x: number, y: number] | null;
  /** True when the boost was fired since the last tick. */
  boost: boolean;
}

/** The level and colours the host has set up for the next match. */
export interface OnlineSetup {
  levelId: string;
  /** The colour ids of the left (host's) and the right (guest's) colony. */
  colors: [string, string];
}

/** What starts an online match on both devices. */
export interface OnlineStart extends OnlineSetup {
  seed: number;
}

/** What the lockstep of a match sends. */
export type LockstepMessage =
  /** A seat's input for tick `t`. */
  | ({ k: 'in'; t: number } & TickInput)
  /** The checksum of the match after tick `t` - see `matchChecksum`. */
  | { k: 'sum'; t: number; h: number };

/**
 * Everything that goes over the wire, told apart by `k`. The matches of a
 * connection are numbered (`n`), so what is left of one that was replaced
 * never reaches the next.
 */
export type NetMessage =
  /** The first word each side says: which version of the game it runs. */
  | { k: 'hello'; v: string }
  /** The host changed the setup of the next match. */
  | ({ k: 'setup' } & OnlineSetup)
  /** The host starts a match. */
  | ({ k: 'start'; n: number } & OnlineStart)
  | (LockstepMessage & { n: number })
  /** The other side leaves. */
  | { k: 'bye' };

/** The longest match a tick may belong to: an hour at 60 ticks a second. */
const MAX_TICK = 60 * 60 * 60;

/**
 * Reads what the other device sent - null for anything that is not a
 * message of this version. The other device is not trusted: every field is
 * checked, and what reaches the match is on the input grid.
 */
export function parseNetMessage(data: unknown): NetMessage | null {
  let value: unknown;
  try {
    value = typeof data === 'string' ? JSON.parse(data) : null;
  } catch {
    return null;
  }
  if (!isObject(value)) {
    return null;
  }
  switch (value['k']) {
    case 'hello':
      return typeof value['v'] === 'string'
        ? { k: 'hello', v: value['v'] }
        : null;
    case 'setup': {
      const setup = parseSetup(value);
      return setup === null ? null : { k: 'setup', ...setup };
    }
    case 'start': {
      const setup = parseSetup(value);
      const { seed, n } = value;
      return setup === null || !isUint32(seed) || !isUint32(n)
        ? null
        : { k: 'start', n, ...setup, seed };
    }
    case 'in': {
      const { t, n } = value;
      const steer = parsePair(value['steer'], 1);
      const drag =
        value['drag'] === null ? null : parsePair(value['drag'], 1e5);
      const boost = value['boost'];
      if (
        !isTick(t) ||
        !isUint32(n) ||
        steer === null ||
        (drag === null && value['drag'] !== null) ||
        typeof boost !== 'boolean'
      ) {
        return null;
      }
      return { k: 'in', n, t, steer, drag, boost };
    }
    case 'sum': {
      const { t, h, n } = value;
      return isTick(t) && isUint32(h) && isUint32(n)
        ? { k: 'sum', n, t, h }
        : null;
    }
    case 'bye':
      return { k: 'bye' };
    default:
      return null;
  }
}

function parseSetup(value: Record<string, unknown>): OnlineSetup | null {
  const levelId = value['levelId'];
  const colors = validColorPair(value['colors']);
  return isLevelId(levelId) && colors != null ? { levelId, colors } : null;
}

/** Two finite numbers no further from 0 than `limit`. */
function parsePair(value: unknown, limit: number): [number, number] | null {
  if (!Array.isArray(value) || value.length !== 2) {
    return null;
  }
  const [x, y] = value;
  return isWithin(x, limit) && isWithin(y, limit) ? [x, y] : null;
}

function isWithin(value: unknown, limit: number): value is number {
  return typeof value === 'number' && Math.abs(value) <= limit;
}

function isTick(value: unknown): value is number {
  return (
    Number.isInteger(value) &&
    (value as number) >= 0 &&
    (value as number) <= MAX_TICK
  );
}

function isUint32(value: unknown): value is number {
  return (
    Number.isInteger(value) &&
    (value as number) >= 0 &&
    (value as number) < 2 ** 32
  );
}
