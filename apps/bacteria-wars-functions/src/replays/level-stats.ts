import {
  isPlainLoadout,
  parseGeneratedId,
  type ReplayHeader,
  TICKS_PER_SEC,
} from '@wolsok/feat-lazy-bac-game/engine';
import {
  FieldValue,
  type Firestore,
  type Transaction,
} from 'firebase-admin/firestore';
import type { Verdict } from '../boards/verify';
import type { ReplayKind } from './accept-plan';

/**
 * The level statistics (ADR 0016 §4): counters per level and bot
 * difficulty in `levelStats/{id}`, added to once a local replay is
 * stored - no uid, increments only, from what the replay claims - and
 * the medallions of the matches re-run (`countRerun`). The admin area's
 * Balance view reads them; nobody else does.
 */

/** The durations a match falls into, by the upper end in seconds. */
const DURATION_BUCKETS: readonly [number, string][] = [
  [60, 'lt1m'],
  [120, 'lt2m'],
  [180, 'lt3m'],
  [300, 'lt5m'],
  [600, 'lt10m'],
];
/** The bucket of a match of ten minutes or more. */
const LONGEST_BUCKET = 'ge10m';

/** What a document of level statistics counts: its id is made of it. */
export interface LevelStatsKey {
  /**
   * A ladder level by its id; a generated one by its recipe and generator
   * difficulty (`gen-cave-6`, `daily-cave-6`, `endless-cave-6`) - every
   * roll is a level of its own, which no table would follow.
   */
  level: string;
  difficulty: string;
  /** The computer it played: the balance table... */
  balanceVersion: number;
  /** ...and the ladder's version, 0 for a computer off the curve. */
  ladder: number;
}

/** The key of the statistics a local replay counts into. */
export function levelStatsKey(
  header: ReplayHeader,
  kind: ReplayKind
): LevelStatsKey {
  const generated = parseGeneratedId(header.levelId);
  const prefix = kind === 'daily' || kind === 'endless' ? kind : 'gen';
  return {
    level:
      generated === null
        ? header.levelId
        : `${prefix}-${generated.recipe}-${generated.difficulty}`,
    difficulty: header.difficulty,
    balanceVersion: header.balanceVersion,
    ladder: header.ladder ?? 0,
  };
}

/** The document id of a key: a changed computer starts counters of its own. */
export function levelStatsId(key: LevelStatsKey): string {
  return `${key.level}_${key.difficulty}_b${key.balanceVersion}_l${key.ladder}`;
}

/**
 * What a local replay adds, as nested counters: an attempt, its result
 * (`wins`, `losses`, `draws`), its duration bucket, the win as
 * `plainWins` or `evolvedWins` and - when the player evolved (genes or a
 * weapon in their own loadout; the ladder's computer brings loadouts to
 * every match) - `evolved` and the weapon carried (`weapons.{id}`).
 */
export function levelStatsCounts(
  header: ReplayHeader
): Record<string, unknown> {
  const winner = header.outcome?.winnerSeat ?? null;
  const seconds = header.ticks / TICKS_PER_SEC;
  const bucket =
    DURATION_BUCKETS.find(([upTo]) => seconds < upTo)?.[1] ?? LONGEST_BUCKET;
  const own = header.loadouts?.[0];
  const evolved = own !== undefined && !isPlainLoadout(own);
  const weapon = own?.weapon ?? null;
  const one = FieldValue.increment(1);
  return {
    attempts: one,
    [winner === null ? 'draws' : winner === 0 ? 'wins' : 'losses']: one,
    durations: { [bucket]: one },
    ...(evolved ? { evolved: one } : {}),
    ...(winner === 0 ? { [evolved ? 'evolvedWins' : 'plainWins']: one } : {}),
    ...(weapon === null ? {} : { weapons: { [weapon]: one } }),
  };
}

/**
 * Adds a stored local replay to its level statistics, with its key as
 * fields for the Balance view to query by.
 */
export async function countLevelStats(
  db: Firestore,
  header: ReplayHeader,
  kind: ReplayKind
): Promise<void> {
  const key = levelStatsKey(header, kind);
  await db.doc(`levelStats/${levelStatsId(key)}`).set(
    {
      ...key,
      updatedAt: FieldValue.serverTimestamp(),
      ...levelStatsCounts(header),
    },
    { merge: true }
  );
}

/**
 * Adds a verified re-run of a match against the computer to its level
 * statistics, in the transaction that applies the verdict - so once, with
 * the state change: `rerun` and the medallion it earned (`medals.{tier}`).
 * Only re-run matches carry them (daily and endless so far), so the medal
 * rate is `medals / rerun`, not `/ attempts`.
 */
export function countRerun(
  tx: Transaction,
  db: Firestore,
  header: ReplayHeader,
  kind: ReplayKind,
  verdict: Verdict
): void {
  if (verdict.state !== 'verified' || verdict.medal === undefined) {
    return;
  }
  const key = levelStatsKey(header, kind);
  const one = FieldValue.increment(1);
  tx.set(
    db.doc(`levelStats/${levelStatsId(key)}`),
    {
      ...key,
      rerun: one,
      ...(verdict.medal === null ? {} : { medals: { [verdict.medal]: one } }),
    },
    { merge: true }
  );
}
