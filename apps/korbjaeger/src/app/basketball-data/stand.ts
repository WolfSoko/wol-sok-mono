/**
 * Why a read was answered from its last good answer: the browser says it
 * has no internet; no server answered (no internet or the server down,
 * which the browser cannot tell); or the proxy reached no DBB.
 */
export type StandGrund = 'kein-internet' | 'keine-verbindung' | 'unavailable';

/**
 * The read was answered from its last good answer: when that came, and
 * why the proxy's own answer could not be had.
 */
export interface Stand {
  /** When the last good answer came, in ms since the epoch. */
  readonly gespeichertAm: number;
  readonly grund: StandGrund;
}

/** The older of two `Stand`s, where a read was answered from several. */
export function aelterer(a: Stand | undefined, b: Stand): Stand {
  return a !== undefined && a.gespeichertAm <= b.gespeichertAm ? a : b;
}

/**
 * The oldest of `staende`, for a screen or card that shows several reads:
 * `undefined` while each was just read.
 */
export function aeltesterStand(
  ...staende: ReadonlyArray<Stand | undefined>
): Stand | undefined {
  return staende.reduce<Stand | undefined>(
    (aeltester, stand) =>
      stand === undefined ? aeltester : aelterer(aeltester, stand),
    undefined
  );
}
