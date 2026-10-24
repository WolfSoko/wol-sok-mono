import { Firestore } from 'firebase-admin/firestore';
import type { Engine } from '../engine';
import { dayOf } from '../time';

/**
 * Who re-runs a replay, each from a budget of its own per UTC day, in match
 * minutes (ADR 0011, ADR 0012). Every re-run goes through `verify.ts`.
 */
export type VerifyPool = 'gallery' | 'admin' | 'daily' | 'endless';

/**
 * What a re-run costs, measured by the CPU benchmark of ADR 0012
 * (`nx run bacteria-wars-functions:benchmark`, median of 3 runs, figures
 * in the ADR): 3.7 to 7.9 ms of CPU a tick on the daily levels on the
 * online grid, 7.7 to 8.2 ms on the ladder's level with neutral colonies.
 * The budgets assume the worst of them, 28 CPU seconds per match minute.
 * A big map (size 2, local matches only) takes up to 37 ms a tick in a
 * contested match, so its re-run is charged this many times its ticks.
 */
export const BIG_MAP_COST = 5;

/**
 * What a re-run of the `gpu-int` ruleset (ADR 0015) costs against the CPU
 * ruleset the budgets were measured on: `IntSimulation` took 6.8 to 9.8 ms
 * of CPU a tick on the online grid where `BacteriaSimulation` took 2.6 to
 * 4.6 ms in the same benchmark run (ADR 0012), 2.1 times the worst. A
 * `gpu-int` re-run is charged this many times its ticks.
 */
export const GPU_INT_COST = 2.5;

/**
 * Match minutes a pool may re-run in a UTC day - the owner's 260 for the
 * boards (60 daily, 180 endless, 20 for "verify now"), at most 7,280 CPU
 * seconds a day at the measured cost, and ADR 0011's 20 gallery
 * candidates of up to 6 minutes. A big map counts {@link BIG_MAP_COST}
 * times, a `gpu-int` replay {@link GPU_INT_COST} times. The hourly function spreads each board pool over the hours left
 * in the day, and unused daily budget passes to endless.
 */
export const VERIFY_MINUTES: Readonly<Record<VerifyPool, number>> = {
  gallery: 120,
  admin: 20,
  daily: 60,
  endless: 180,
};

/** The longest match the gallery or a featuring owner re-runs, in minutes. */
export const MAX_GALLERY_MINUTES = 6;

/** Match minutes in ticks of the engine's fixed step. */
export function minuteTicks(
  engine: Pick<Engine, 'TICKS_PER_SEC'>,
  minutes: number
): number {
  return minutes * 60 * engine.TICKS_PER_SEC;
}

/**
 * The ticks a re-run is charged: more on a big map, and more on the
 * `gpu-int` ruleset (replay version 5, every ranked attempt), which
 * `IntSimulation` re-runs - see {@link GPU_INT_COST}.
 */
export function rerunCost(
  engine: Pick<Engine, 'getLevel' | 'levelSize' | 'GPU_INT_REPLAY_VERSION'>,
  levelId: string,
  ticks: number,
  replayVersion: number
): number {
  const map = engine.levelSize(engine.getLevel(levelId)) > 1 ? BIG_MAP_COST : 1;
  const ruleset =
    replayVersion === engine.GPU_INT_REPLAY_VERSION ? GPU_INT_COST : 1;
  return Math.ceil(ticks * map * ruleset);
}

/**
 * Where a re-run is paid from: the pool for its cost - null when none may
 * pay it - and the charge, once the budget is reserved. `verifyStored`
 * asks it, since it knows the cost.
 */
export interface Payer {
  pool(cost: number): VerifyPool | null;
  charge(pool: VerifyPool, cost: number): void;
}

/** A payer that always takes one pool, whose own budget is the limit. */
export function fixedPool(pool: VerifyPool): Payer {
  return { pool: () => pool, charge: () => undefined };
}

/**
 * Reserves `ticks` of match time from a pool's budget of the day - false,
 * and nothing reserved, when the rest of the budget is smaller. An
 * exhausted budget never shows a claim as verified: it waits.
 */
export async function reserveVerification(
  db: Firestore,
  engine: Pick<Engine, 'TICKS_PER_SEC'>,
  pool: VerifyPool,
  ticks: number,
  now = Date.now()
): Promise<boolean> {
  const ref = db.doc(`counters/${dayOf(now)}`);
  const cap = minuteTicks(engine, VERIFY_MINUTES[pool]);
  return db.runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    const used = (doc.get(`verifyTicks.${pool}`) as number | undefined) ?? 0;
    if (used + ticks > cap) {
      return false;
    }
    tx.set(ref, { verifyTicks: { [pool]: used + ticks } }, { merge: true });
    return true;
  });
}
