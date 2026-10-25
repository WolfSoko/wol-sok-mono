import {
  parseGeneratedId,
  playsEvolution,
  type Replay,
  TICKS_PER_SEC,
} from '@wolsok/feat-lazy-bac-game/engine';
import {
  type DocumentReference,
  FieldValue,
  type Firestore,
} from 'firebase-admin/firestore';
import type { ReplayKind } from './accept-plan';

/**
 * The level statistics (ADR 0016 §4): counters per level and bot
 * difficulty in `levelStats/{id}`, added to when a local replay is
 * stored - no uid, increments only. The admin area's Balance view reads
 * them; nobody else does.
 */

/** The durations a match falls into, by the upper end in seconds. */
const DURATION_BUCKETS: readonly [number, string][] = [
  [60, 'lt1m'],
  [120, 'lt2m'],
  [180, 'lt3m'],
  [300, 'lt5m'],
  [600, 'lt10m'],
  [Infinity, 'ge10m'],
];

/**
 * The document a local replay counts into: a ladder level by its id, a
 * generated one by its style and heat - every roll is a level of its own,
 * which no table would follow - with the daily and endless levels apart.
 * Per bot difficulty.
 */
export function levelStatsId(
  header: { levelId: string; difficulty: string },
  kind: ReplayKind
): string {
  const generated = parseGeneratedId(header.levelId);
  let level = header.levelId;
  if (generated !== null) {
    level =
      kind === 'daily' || kind === 'endless'
        ? `${kind}-${generated.difficulty}`
        : `gen-${generated.recipe}-${generated.difficulty}`;
  }
  return `${level}_${header.difficulty}`;
}

/**
 * What a local replay adds, as nested counters: an attempt, its result
 * (`wins`, `losses`, `draws`), its duration bucket and - with evolution -
 * `evolved`, the win as `plainWins` or `evolvedWins` and the weapon the
 * player carried (`weapons.{id}`).
 */
export function levelStatsCounts(replay: Replay): Record<string, unknown> {
  const { header } = replay;
  const winner = header.outcome?.winnerSeat ?? null;
  const seconds = header.ticks / TICKS_PER_SEC;
  const bucket =
    DURATION_BUCKETS.find(([upTo]) => seconds < upTo)?.[1] ?? 'ge10m';
  const evolved = playsEvolution(replay);
  const weapon = header.loadouts?.[0].weapon ?? null;
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

/** Adds a stored local replay to its level statistics, in `writer`. */
export function countLevelStats(
  writer: {
    set(
      ref: DocumentReference,
      data: Record<string, unknown>,
      options: { merge: true }
    ): unknown;
  },
  db: Firestore,
  replay: Replay,
  kind: ReplayKind
): void {
  const { levelId, difficulty } = replay.header;
  writer.set(
    db.doc(`levelStats/${levelStatsId({ levelId, difficulty }, kind)}`),
    {
      levelId,
      difficulty,
      updatedAt: FieldValue.serverTimestamp(),
      ...levelStatsCounts(replay),
    },
    { merge: true }
  );
}
