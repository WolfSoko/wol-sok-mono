import { validColorPair } from '../state/colony-colors';
import { BALANCE_VERSION } from '../state/game-balance';
import { isObject } from '../state/is-object';
import { isLevelId } from '../state/levels';
import { TICKS_PER_SEC } from '../state/fixed-tick';
import { parseStoredJson } from '../storage/stored-json';

/**
 * The version of what two devices say to each other - a new one for every
 * change an older game could not follow. Both sides also need the same
 * balance table, or the same inputs play another match.
 */
export const NET_VERSION = `2/${BALANCE_VERSION}`;

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

/**
 * Everything that goes over the wire, told apart by `k`. The matches of a
 * connection are numbered (`n`), so what is left of one that was replaced
 * never reaches the next.
 */
export type NetMessage =
  /**
   * The first word each side says: which version of the game it runs, and
   * who plays it - their uid, for their profile.
   */
  | { k: 'hello'; v: string; id: string | null }
  /** The host changed the setup of the next match. */
  | ({ k: 'setup' } & OnlineSetup)
  /** The host starts a match. */
  | ({ k: 'start'; n: number } & OnlineStart)
  /** A seat's input for tick `t`. */
  | ({ k: 'in'; n: number; t: number } & TickInput)
  /** The checksum of the match after tick `t` - see `matchChecksum`. */
  | { k: 'sum'; n: number; t: number; h: number }
  /** The other side leaves. */
  | { k: 'bye' };

/** The longest match a tick may belong to: an hour. */
const MAX_TICK = 60 * 60 * TICKS_PER_SEC;
/** The biggest seed or match number. */
const MAX_UINT32 = 2 ** 32 - 1;

/**
 * Reads what the other device sent - null for anything that is not a
 * message of this version. The other device is not trusted: every field is
 * checked, and what reaches the match is on the input grid.
 */
export function parseNetMessage(data: unknown): NetMessage | null {
  const value = typeof data === 'string' ? parseStoredJson(data) : null;
  if (!isObject(value)) {
    return null;
  }
  switch (value['k']) {
    case 'hello': {
      const { v, id } = value;
      if (typeof v !== 'string') {
        return null;
      }
      return { k: 'hello', v, id: isPlayerId(id) ? id : null };
    }
    case 'setup': {
      const setup = parseSetup(value);
      return setup === null ? null : { k: 'setup', ...setup };
    }
    case 'start': {
      const setup = parseSetup(value);
      const { seed, n } = value;
      return setup === null ||
        !isUpTo(seed, MAX_UINT32) ||
        !isUpTo(n, MAX_UINT32)
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
        !isUpTo(t, MAX_TICK) ||
        !isUpTo(n, MAX_UINT32) ||
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
      return isUpTo(t, MAX_TICK) &&
        isUpTo(h, MAX_UINT32) &&
        isUpTo(n, MAX_UINT32)
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

/** True for something that can be a Firebase uid. */
function isPlayerId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
}

/** An integer from 0 to `max`. */
function isUpTo(value: unknown, max: number): value is number {
  return (
    Number.isInteger(value) &&
    (value as number) >= 0 &&
    (value as number) <= max
  );
}
