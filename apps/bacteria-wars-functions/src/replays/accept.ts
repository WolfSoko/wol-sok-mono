import {
  type Replay,
  replayFromBytes,
} from '@wolsok/feat-lazy-bac-game/engine';
import {
  type DocumentSnapshot,
  FieldValue,
  type Firestore,
  Timestamp,
  type Transaction,
  type WriteBatch,
} from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/logger';
import { trackDeclaredMatch } from '../boards/rank-endless';
import { NOT_REPORTED_AFTER_MS, REPLAY_TTL_MS } from '../config';
import { hasGrpcCode } from '../grpc';
import { isBanned, takeSubmissionSlot } from '../limits';
import {
  planAcceptance,
  type AcceptPlan,
  type Rejection,
  type SubmissionMeta,
} from './accept-plan';
import { countLevelStats } from './level-stats';

/** What became of a submission - for the log and the specs. */
export type AcceptOutcome =
  | 'stored'
  | 'reported'
  | 'malformed'
  | 'banned'
  | 'limit'
  | 'cap'
  | 'unparsable'
  | 'not-in-room'
  | 'duplicate'
  | 'closed'
  | 'exists'
  | Rejection;

/** A room stub (ADR 0011): who played, and how long it counts. */
interface RoomStub {
  host?: unknown;
  guest?: unknown;
  createdAt?: unknown;
  taken?: unknown;
  expireAt?: unknown;
}

/**
 * Turns `replaySubmissions/{id}` into `replays/{id}` (ADR 0011) and deletes
 * the submission, whatever came of it - unless it throws: `acceptReplay`
 * then tries again, and gives up with {@link giveUpSubmission}. Nothing is
 * played again here: the replay is parsed strictly, bound to its players
 * and stored.
 * - A local match is the caller's alone, `submitted`, and counts in its
 *   level statistics (`level-stats.ts`, ADR 0016).
 * - An online match lists each player of its room stub once their own report
 *   arrives: `waiting` with one, `agreed` or `disputed` with both. A second
 *   report after the hourly function closed the match with one ("Not
 *   reported", ADR 0012) is dropped as `closed`.
 * - A ranked submission over the day's cap for everyone (`cap`) voids its
 *   attempt: a drop on the server's side never costs one (ADR 0012).
 */
export async function acceptSubmission(
  db: Firestore,
  submissionId: string,
  data: Record<string, unknown>,
  now: number = Date.now()
): Promise<AcceptOutcome> {
  const outcome = await accept(db, submissionId, data, now);
  await db.doc(`replaySubmissions/${submissionId}`).delete();
  if (outcome !== 'stored' && outcome !== 'reported') {
    logger.info('Replay submission dropped', { submissionId, outcome });
  }
  return outcome;
}

async function accept(
  db: Firestore,
  submissionId: string,
  data: Record<string, unknown>,
  now: number
): Promise<AcceptOutcome> {
  const meta = submissionMeta(submissionId, data, now);
  const bytes = data['bytes'];
  if (meta === null || !(bytes instanceof Uint8Array)) {
    return 'malformed';
  }
  if (await isBanned(db, meta.uid, now)) {
    return 'banned';
  }
  const refused = await takeSubmissionSlot(
    db,
    meta.uid,
    meta.attempt !== undefined,
    submissionId,
    now
  );
  if (refused === 'cap' && meta.attempt !== undefined) {
    await voidAttempt(db, { ...meta, attempt: meta.attempt }, refused, now);
  }
  if (refused !== null) {
    return refused;
  }
  const replay = await replayFromBytes(new Uint8Array(bytes), { stored: true });
  if (replay === null) {
    return 'unparsable';
  }
  const plan = planAcceptance(replay, meta);
  if (typeof plan === 'string') {
    return plan;
  }
  const blob = { bytes, size: bytes.length };
  return plan.room === undefined
    ? storeLocal(db, replay, plan, meta, blob, now)
    : storeOnline(db, plan, meta, blob, now);
}

/**
 * Ends a submission `acceptReplay` failed on for an hour: deletes it, and
 * voids its attempt - the failure was the server's, so it must not cost
 * the player the attempt. (`voidAttempt` leaves one whose replay got
 * stored after all.)
 */
export async function giveUpSubmission(
  db: Firestore,
  submissionId: string,
  data: Record<string, unknown>,
  now: number
): Promise<void> {
  const meta = submissionMeta(submissionId, data, now);
  if (meta?.attempt !== undefined) {
    await voidAttempt(db, { ...meta, attempt: meta.attempt }, 'error', now);
  }
  await db.doc(`replaySubmissions/${submissionId}`).delete();
}

/**
 * Marks a declared attempt the server dropped `void` (ADR 0012): its replay
 * never ranks, and it costs nothing - a daily attempt may be declared again
 * in its place (`firestore.rules`), an endless match counts as not played,
 * so its run is computed again. Only the functions write it. An attempt
 * that already has a stored replay (`replayId`) is used, and stays so,
 * whatever else names it later; one declared again after the submission
 * was sent is another declaration, left alone (`belongsTo`).
 */
export async function voidAttempt(
  db: Firestore,
  submission: Pick<SubmissionMeta, 'uid' | 'createdAt'> & { attempt: string },
  reason: 'cap' | 'error',
  now: number
): Promise<void> {
  const { uid, attempt: attemptId } = submission;
  const ref = db.doc(`players/${uid}/attempts/${attemptId}`);
  const isVoid = await db.runTransaction(async (tx) => {
    const attempt = await tx.get(ref);
    if (
      !belongsTo(attempt, submission.createdAt) ||
      attempt.get('replayId') !== undefined
    ) {
      return false;
    }
    if (attempt.get('void') !== true) {
      tx.update(ref, {
        void: true,
        voidReason: reason,
        voidedAt: FieldValue.serverTimestamp(),
      });
      logger.warn('Ranked attempt voided', { uid, attemptId, reason });
    }
    return true;
  });
  // Also when an earlier try voided it: its refresh may have failed.
  if (isVoid) {
    await trackDeclaredMatch(db, uid, attemptId, now);
  }
}

/**
 * True when a submission sent at `sentAt` can be of this declaration: one
 * declared again later (a void daily attempt, `firestore.rules`) is not.
 */
function belongsTo(attempt: DocumentSnapshot, sentAt: number): boolean {
  const at = attempt.get('at');
  return at instanceof Timestamp && at.toMillis() <= sentAt;
}

function submissionMeta(
  id: string,
  data: Record<string, unknown>,
  now: number
): SubmissionMeta | null {
  const { uid, hint, attempt, createdAt } = data;
  if (
    typeof uid !== 'string' ||
    typeof hint !== 'number' ||
    (attempt !== undefined && typeof attempt !== 'string')
  ) {
    return null;
  }
  return {
    id,
    uid,
    hint,
    ...(attempt === undefined ? {} : { attempt }),
    createdAt: createdAt instanceof Timestamp ? createdAt.toMillis() : now,
  };
}

/** The fields every new `replays/{id}` gets beside its record. */
function newReplay(plan: AcceptPlan, uid: string, state: string, now: number) {
  return {
    ...plan.record,
    players: [uid],
    state,
    optOut: [],
    createdAt: FieldValue.serverTimestamp(),
    expireAt: Timestamp.fromMillis(now + REPLAY_TTL_MS),
  };
}

async function storeLocal(
  db: Firestore,
  replay: Replay,
  plan: AcceptPlan,
  meta: SubmissionMeta,
  blob: { bytes: Uint8Array; size: number },
  now: number
): Promise<AcceptOutcome> {
  const ref = db.doc(`replays/${plan.id}`);
  const create = (writer: Transaction | WriteBatch) => {
    writer.create(ref, {
      ...newReplay(plan, meta.uid, 'submitted', now),
      // When the player sent it - a ranked replay's deadline (ADR 0012).
      ...(meta.attempt === undefined
        ? {}
        : { submittedAt: Timestamp.fromMillis(meta.createdAt) }),
    });
    writer.create(ref.collection('blob').doc('data'), blob);
    // Counted once: a second delivery fails on the create above.
    countLevelStats(writer, db, replay, plan.kind);
  };
  const { attempt } = meta;
  try {
    if (attempt === undefined) {
      const batch = db.batch();
      create(batch);
      await batch.commit();
      return 'stored';
    }
    return await db.runTransaction(async (tx) => {
      const declared = await tx.get(
        db.doc(`players/${meta.uid}/attempts/${attempt}`)
      );
      create(tx);
      // The first stored replay uses its attempt up: no drop voids it now.
      if (
        belongsTo(declared, meta.createdAt) &&
        declared.get('replayId') === undefined
      ) {
        tx.update(declared.ref, { replayId: plan.id });
      }
      return 'stored' as const;
    });
  } catch (error) {
    if (hasGrpcCode(error, 6, 'already-exists')) {
      return 'exists';
    }
    throw error;
  }
}

async function storeOnline(
  db: Firestore,
  plan: AcceptPlan,
  meta: SubmissionMeta,
  blob: { bytes: Uint8Array; size: number },
  now: number
): Promise<AcceptOutcome> {
  const room = plan.room;
  if (room === undefined) {
    return 'not-in-room';
  }
  // The players come from the room stub, never from what a peer said.
  const stub = (await db.doc(`rooms/${room.code}`).get()).data() as
    | RoomStub
    | undefined;
  const seats = [stub?.host, stub?.guest];
  if (stub?.taken !== true || !seats.includes(meta.uid)) {
    return 'not-in-room';
  }
  const other = seats.find((uid) => uid !== meta.uid);
  const expired =
    !(stub.expireAt instanceof Timestamp) || stub.expireAt.toMillis() <= now;
  const ref = db.doc(`replays/${plan.id}`);
  const report = {
    checksum: plan.record.checksum,
    winnerSeat: plan.record.winnerSeat,
    endedBy: plan.record.endedBy,
    inputsHash: plan.inputsHash ?? null,
    at: FieldValue.serverTimestamp(),
  };
  return db.runTransaction(async (tx) => {
    const existing = await tx.get(ref);
    if (!existing.exists) {
      tx.create(ref, {
        ...newReplay(plan, meta.uid, 'waiting', now),
        room: room.code,
        // Who played which seat (host 0, guest 1) and since when the room
        // stood - what the online board counts by (ADR 0012).
        seats: [stub.host, stub.guest],
        stubCreatedAt:
          stub.createdAt instanceof Timestamp ? stub.createdAt : null,
        // Reported after its stub expired: kept for its players, never public.
        stubExpired: expired,
        // When the hourly sweep closes it without a second report.
        closeAt: Timestamp.fromMillis(now + NOT_REPORTED_AFTER_MS),
      });
      tx.create(ref.collection('blob').doc('data'), blob);
      tx.create(ref.collection('reports').doc(meta.uid), report);
      return 'stored';
    }
    const players = existing.get('players');
    if (
      !Array.isArray(players) ||
      players.includes(meta.uid) ||
      existing.get('state') !== 'waiting'
    ) {
      return 'duplicate';
    }
    // Closed with one report (`closeNotReported`'s answer, maybe a "Not
    // reported" for this very player): a late report changes nothing.
    // Whoever writes the `rankedReplays` marker answers the replay in the
    // same transaction, and the marker never outlives the replay.
    if (existing.get('rankedReason') !== undefined) {
      return 'closed';
    }
    const theirs =
      typeof other === 'string'
        ? await tx.get(ref.collection('reports').doc(other))
        : null;
    const agreed =
      theirs?.exists === true &&
      theirs.get('checksum') === report.checksum &&
      theirs.get('winnerSeat') === report.winnerSeat &&
      theirs.get('endedBy') === report.endedBy &&
      theirs.get('inputsHash') === report.inputsHash;
    tx.create(ref.collection('reports').doc(meta.uid), report);
    tx.update(ref, {
      players: FieldValue.arrayUnion(meta.uid),
      state: agreed ? 'agreed' : 'disputed',
      closeAt: FieldValue.delete(),
      ...(expired ? { stubExpired: true } : {}),
    });
    return 'reported';
  });
}
