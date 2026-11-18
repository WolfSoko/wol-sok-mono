/**
 * The CPU side of the GPU simulation's data flow (ADR 0015, decision 2):
 * which report the CPU works with, and the divide budget it makes of it.
 *
 * The float simulation takes every report as soon as the GPU has finished
 * reading it back, so what it knows - the colony counts, the pellets'
 * eaters, the bots' view of the enemy - depends on how fast the device is.
 * The deterministic one takes the report rendered in tick `t` at the start
 * of tick `t + DETERMINISTIC_REPORT_LAG`, waiting for it if the GPU is not
 * done yet, so every device knows the same at every tick.
 */

/**
 * How many ticks the report the deterministic simulation works with lags
 * behind the war. A report is rendered at the end of tick `t`, its read back
 * requested in tick `t + 1` (reading it in the tick it was drawn in would
 * stall the GPU at once) and taken in tick `t + 3`, which leaves the GPU two
 * ticks to finish it - a wait is rare - and needs three read back buffers:
 * the one taken, the one still in flight and the one requested.
 */
export const DETERMINISTIC_REPORT_LAG = 3;

/** A report read back the GPU was asked for, as far as the CPU knows. */
export interface PendingReadback {
  /** The tick the report was rendered in. */
  step: number;
  /** True once the GPU has finished it - taking it then costs no wait. */
  ready: boolean;
  /** Requested in an earlier match: taken to free its buffer, then dropped. */
  stale: boolean;
}

/**
 * How many of the pending read backs, oldest first, to take in tick `step`.
 *
 * Without a lag (the float simulation) it takes the ready ones up to the
 * first that is not. With one, it takes every report rendered at least
 * `lag` ticks ago - and every stale one - whether ready or not: the caller
 * then waits for the GPU. The GPU finishes them in order, so either way
 * the ones taken are a prefix.
 */
export function readbacksToTake(
  pending: readonly PendingReadback[],
  step: number,
  lag: number | null
): number {
  let count = 0;
  for (const readback of pending) {
    const due =
      lag === null
        ? readback.ready
        : readback.stale || readback.step <= step - lag;
    if (!due) {
      break;
    }
    count++;
  }
  return count;
}

/**
 * The most a bacterium of a colony may divide with in a tick, whatever
 * ground it is on. All of them divide in the same pass, and the count is
 * `stepsBehind` ticks old - so the chance is cut down until even the
 * bacteria born in the ticks the count lags behind fit into the room the
 * colony has left.
 */
export function divideBudgetOf(
  capacity: number,
  count: number,
  stepsBehind: number
): number {
  const room = capacity - count;
  return room <= 0 ? 0 : room / (Math.max(1, count) * (stepsBehind + 1));
}
