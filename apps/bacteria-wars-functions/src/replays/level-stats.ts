import {
  isPlainLoadout,
  parseGeneratedId,
  type Replay,
  type ReplayHeader,
  TICKS_PER_SEC,
} from '@wolsok/feat-lazy-bac-game/engine';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import type { ReplayKind } from './accept-plan';

/**
 * The level statistics (ADR 0016 §4): counters per level and bot
 * difficulty in `levelStats/{id}`, added to once a local replay is
 * stored - no uid, increments only, from what the replay claims. The admin area's Balance view reads
 * them; nobody else does.
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

/**
 * The level a local replay counts for: a ladder level by its id, a
 * generated one by its style and heat - every roll is a level of its own,
 * which no table would follow - with the daily and endless levels apart.
 */
export function statsLevel(levelId: string, kind: ReplayKind): string {
  const generated = parseGeneratedId(levelId);
  if (generated === null) {
    return levelId;
  }
  return kind === 'daily' || kind === 'endless'
    ? `${kind}-${generated.difficulty}`
    : `gen-${generated.recipe}-${generated.difficulty}`;
}

/**
 * The document a local replay counts into: its level, the bot difficulty,
 * and the computer it played - the balance table and the ladder's version
 * (0 for a computer off the curve) - so a change to either starts counters
 * of its own instead of mixing into the old ones.
 */
export function levelStatsId(header: ReplayHeader, kind: ReplayKind): string {
  return [
    statsLevel(header.levelId, kind),
    header.difficulty,
    `b${header.balanceVersion}`,
    `l${header.ladder ?? 0}`,
  ].join('_');
}

/**
 * What a local replay adds, as nested counters: an attempt, its result
 * (`wins`, `losses`, `draws`), its duration bucket, the win as
 * `plainWins` or `evolvedWins` and - when the player evolved (genes or a
 * weapon in their own loadout; the ladder's computer brings loadouts to
 * every match) - `evolved` and the weapon carried (`weapons.{id}`).
 */
export function levelStatsCounts(replay: Replay): Record<string, unknown> {
  const { header } = replay;
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

/** Adds a stored local replay to its level statistics. */
export async function countLevelStats(
  db: Firestore,
  replay: Replay,
  kind: ReplayKind
): Promise<void> {
  const { header } = replay;
  await db.doc(`levelStats/${levelStatsId(header, kind)}`).set(
    {
      level: statsLevel(header.levelId, kind),
      difficulty: header.difficulty,
      balanceVersion: header.balanceVersion,
      ladder: header.ladder ?? 0,
      updatedAt: FieldValue.serverTimestamp(),
      ...levelStatsCounts(replay),
    },
    { merge: true }
  );
}
