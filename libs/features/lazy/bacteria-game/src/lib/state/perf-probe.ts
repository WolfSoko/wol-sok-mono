/**
 * The frame-time spec's window into the engine (ADR 0014, gate 3): the spec
 * puts a probe on the page before it loads, and the game then records how
 * long each tick of a match took. The game never makes one, so in play
 * nothing is measured.
 */

/** Where the spec puts the probe, on `window`. */
export const PERF_PROBE_KEY = '__bacteriaPerfProbe';

/** What the spec reads back: milliseconds per tick, in order. */
export interface PerfProbe {
  tickMs: number[];
}

/** The probe a spec put on `scope`, or null - in play always null. */
export function perfProbeOf(scope: object): PerfProbe | null {
  const probe: unknown = Reflect.get(scope, PERF_PROBE_KEY);
  return typeof probe === 'object' &&
    probe !== null &&
    Array.isArray((probe as Partial<PerfProbe>).tickMs)
    ? (probe as PerfProbe)
    : null;
}
