import type { ReadOptions } from '@wolsok/feat-shared-basketball-data';

/** Why a read was answered from its last good answer. */
export type StandGrund = 'offline' | 'unavailable';

/**
 * The read was answered from its last good answer: when that came, and
 * why the proxy's own answer could not be had.
 */
export interface Stand {
  /** When the last good answer came, in ms since the epoch. */
  readonly gespeichertAm: number;
  readonly grund: StandGrund;
}

/**
 * A read's options in the app: `beiStand` hears of each answer of the read
 * that came from the last good one. `DbbBasketballData` hands them to the
 * transport as they are.
 */
export interface StandReadOptions extends ReadOptions {
  readonly beiStand?: (stand: Stand) => void;
}

/** The `beiStand` of a read's options, where they carry one. */
export function beiStandVon(
  options: ReadOptions | undefined
): ((stand: Stand) => void) | undefined {
  const beiStand =
    options !== undefined && 'beiStand' in options
      ? options.beiStand
      : undefined;
  return typeof beiStand === 'function'
    ? (beiStand as (stand: Stand) => void)
    : undefined;
}

/** The older of two `Stand`s, where a read was answered from several. */
export function aelterer(a: Stand | undefined, b: Stand): Stand {
  return a !== undefined && a.gespeichertAm <= b.gespeichertAm ? a : b;
}
