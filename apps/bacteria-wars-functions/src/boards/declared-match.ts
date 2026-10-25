import {
  type Attempt,
  attemptSeed,
  declaredBeforeMatch,
  isRankedPlan,
  parseAttemptId,
  type Replay,
  replayFromBytes,
  submissionDeadline,
} from '@wolsok/feat-lazy-bac-game/engine';
import {
  type DocumentSnapshot,
  FieldValue,
  type Firestore,
  Timestamp,
} from 'firebase-admin/firestore';
import { isBanned } from '../limits';

/**
 * What every declared match - daily or endless - goes through when its
 * replay comes (ADR 0012): the stored replay, its declaration, the checks
 * against it, and the `rankedReason` the replay carries.
 */

/** What {@link checkDeclaredMatch} finds. */
export type DeclaredReason =
  | 'counted'
  | 'ruleset'
  | 'seed'
  | 'plan-mismatch'
  | 'level'
  | 'early'
  | 'late';

/** Why a ranked replay did (not) count - its `rankedReason`. */
export type ArrivalReason =
  | DeclaredReason
  | 'banned'
  | 'no-attempt'
  | 'duplicate'
  | 'unreadable';

/**
 * The checks every declared match passes, always against the stored
 * declaration, never the header's copy of `at`: the owner's decision that
 * ranked matches are `gpu-int` only (ADR 0015); the seed from the
 * declaration; exactly the ranked plan; the level, when the caller knows it
 * already; a declaration before the match; an upload within its deadline.
 */
export function checkDeclaredMatch(
  replay: Replay,
  uid: string,
  attemptId: string,
  declaredAt: number,
  arrivedAt: number,
  levelId?: string
): DeclaredReason {
  const { header } = replay;
  if (header.simulation !== 'gpu-int') {
    return 'ruleset';
  }
  if (header.seed !== attemptSeed(uid, attemptId, declaredAt)) {
    return 'seed';
  }
  if (!isRankedPlan(header)) {
    return 'plan-mismatch';
  }
  if (levelId !== undefined && header.levelId !== levelId) {
    return 'level';
  }
  if (!declaredBeforeMatch(declaredAt, header.ticks, arrivedAt)) {
    return 'early';
  }
  if (arrivedAt > submissionDeadline(declaredAt, header.ticks)) {
    return 'late';
  }
  return 'counted';
}

/** A stored replay read back - null when it is gone or damaged. */
export async function storedReplay(
  db: Firestore,
  replayId: string
): Promise<Replay | null> {
  const bytes = (await db.doc(`replays/${replayId}/blob/data`).get()).get(
    'bytes'
  );
  return bytes instanceof Uint8Array
    ? replayFromBytes(new Uint8Array(bytes), { stored: true })
    : null;
}

/** What a ranking writes on the replay. */
export function rankedFields(reason: ArrivalReason) {
  return { rankedReason: reason, rankedAt: FieldValue.serverTimestamp() };
}

/**
 * A replay read in a ranking transaction: null while it may still rank,
 * else what the ranking returns - `gone` (its account was deleted) or the
 * answer an earlier delivery stored. `rankReplay` retries, and a replay
 * keeps its answer, even when a ban or an expired declaration would answer
 * otherwise now.
 */
export function earlierAnswer(
  replay: DocumentSnapshot
): ArrivalReason | 'gone' | null {
  if (!replay.exists) {
    return 'gone';
  }
  const ranked = replay.get('rankedReason');
  return typeof ranked === 'string' ? (ranked as ArrivalReason) : null;
}

/** Stores why a replay does not rank, unless {@link earlierAnswer} has one. */
export async function answerReplay(
  db: Firestore,
  replayId: string,
  reason: ArrivalReason
): Promise<ArrivalReason | 'gone'> {
  const replayRef = db.doc(`replays/${replayId}`);
  return db.runTransaction(async (tx) => {
    const earlier = earlierAnswer(await tx.get(replayRef));
    if (earlier !== null) {
      return earlier;
    }
    tx.update(replayRef, rankedFields(reason));
    return reason;
  });
}

/** A declared replay ready for its board's checks. */
export interface DeclaredReplay<A extends Attempt> {
  uid: string;
  attemptId: string;
  attempt: A;
  /** The server's time of the declaration. */
  declaredAt: number;
  /** The submission's `createdAt` (request.time), else the replay's own. */
  arrivedAt: number;
  replay: Replay;
}

/**
 * Reads what a new replay of a declared `kind` attempt needs: its player,
 * the stored declaration and the replay itself - or why it cannot rank
 * (`no-attempt`, `banned`, `unreadable`).
 */
export async function readDeclaredReplay<K extends Attempt['kind']>(
  db: Firestore,
  replayId: string,
  replayDoc: Record<string, unknown>,
  kind: K,
  now: number
): Promise<
  DeclaredReplay<Extract<Attempt, { kind: K }>> | { reason: ArrivalReason }
> {
  const uid = (replayDoc['players'] as string[] | undefined)?.[0];
  const attemptId = (replayDoc['attempt'] as { id?: unknown } | undefined)?.id;
  const attempt =
    typeof attemptId === 'string' ? parseAttemptId(attemptId) : null;
  if (
    typeof uid !== 'string' ||
    typeof attemptId !== 'string' ||
    attempt?.kind !== kind
  ) {
    return { reason: 'no-attempt' };
  }
  const [banned, declaration, replay] = await Promise.all([
    isBanned(db, uid, now),
    db.doc(`players/${uid}/attempts/${attemptId}`).get(),
    storedReplay(db, replayId),
  ]);
  const at = declaration.get('at');
  if (banned) {
    return { reason: 'banned' };
  }
  if (!(at instanceof Timestamp)) {
    return { reason: 'no-attempt' };
  }
  if (replay === null) {
    return { reason: 'unreadable' };
  }
  const sent = replayDoc['submittedAt'] ?? replayDoc['createdAt'];
  return {
    uid,
    attemptId,
    attempt: attempt as Extract<Attempt, { kind: K }>,
    declaredAt: at.toMillis(),
    arrivedAt: sent instanceof Timestamp ? sent.toMillis() : now,
    replay,
  };
}
