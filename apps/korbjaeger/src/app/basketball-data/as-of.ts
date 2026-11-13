/**
 * Why a read was answered from its last good answer: the browser says it
 * has no internet; no server answered (no internet or the server down,
 * which the browser cannot tell); or the proxy reached no DBB.
 */
export type AsOfReason = 'no-internet' | 'no-connection' | 'unavailable';

/**
 * The read was answered from its last good answer: when that came, and
 * why the proxy's own answer could not be had.
 */
export interface AsOf {
  /** When the last good answer came, in ms since the epoch. */
  readonly storedAt: number;
  readonly reason: AsOfReason;
}

/** The older of two `AsOf`s, where a read was answered from several. */
export function older(a: AsOf | undefined, b: AsOf): AsOf {
  return a !== undefined && a.storedAt <= b.storedAt ? a : b;
}

/**
 * The oldest of `asOfs`, for a screen or card that shows several reads:
 * `undefined` while each was just read.
 */
export function oldestAsOf(
  ...asOfs: ReadonlyArray<AsOf | undefined>
): AsOf | undefined {
  return asOfs.reduce<AsOf | undefined>(
    (oldest, asOf) => (asOf === undefined ? oldest : older(oldest, asOf)),
    undefined
  );
}
