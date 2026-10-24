import { replayFromBytes } from '@wolsok/feat-lazy-bac-game/engine';
import {
  FieldValue,
  type Firestore,
  Timestamp,
} from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/logger';
import { REPLAY_TTL_MS } from '../config';
import { isBanned, takeSubmissionSlot } from '../limits';
import {
  planAcceptance,
  type AcceptPlan,
  type Rejection,
  type SubmissionMeta,
} from './accept-plan';

/** What became of a submission - for the log and the specs. */
export type AcceptOutcome =
  | 'stored'
  | 'reported'
  | 'malformed'
  | 'banned'
  | 'limit'
  | 'unparsable'
  | 'not-in-room'
  | 'duplicate'
  | 'exists'
  | Rejection;

/** A room stub (ADR 0011): who played, and how long it counts. */
interface RoomStub {
  host?: unknown;
  guest?: unknown;
  taken?: unknown;
  expireAt?: unknown;
}

/**
 * Turns `replaySubmissions/{id}` into `replays/{id}` (ADR 0011) and deletes
 * the submission, whatever came of it. Nothing is played again here: the
 * replay is parsed strictly, bound to its players and stored.
 * - A local match is the caller's alone, `submitted`.
 * - An online match lists each player of its room stub once their own report
 *   arrives: `waiting` with one, `agreed` or `disputed` with both.
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
  if (
    !(await takeSubmissionSlot(db, meta.uid, meta.attempt !== undefined, now))
  ) {
    return 'limit';
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
    ? storeLocal(db, plan, meta, blob, now)
    : storeOnline(db, plan, meta, blob, now);
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
  plan: AcceptPlan,
  meta: SubmissionMeta,
  blob: { bytes: Uint8Array; size: number },
  now: number
): Promise<AcceptOutcome> {
  const ref = db.doc(`replays/${plan.id}`);
  try {
    const batch = db.batch();
    batch.create(ref, newReplay(plan, meta.uid, 'submitted', now));
    batch.create(ref.collection('blob').doc('data'), blob);
    await batch.commit();
    return 'stored';
  } catch (error) {
    if (isAlreadyExists(error)) {
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
    at: FieldValue.serverTimestamp(),
  };
  return db.runTransaction(async (tx) => {
    const existing = await tx.get(ref);
    if (!existing.exists) {
      tx.create(ref, {
        ...newReplay(plan, meta.uid, 'waiting', now),
        room: room.code,
        // Reported after its stub expired: kept for its players, never public.
        stubExpired: expired,
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
    const theirs =
      typeof other === 'string'
        ? await tx.get(ref.collection('reports').doc(other))
        : null;
    const agreed =
      theirs?.exists === true &&
      theirs.get('checksum') === report.checksum &&
      theirs.get('winnerSeat') === report.winnerSeat &&
      theirs.get('endedBy') === report.endedBy;
    tx.create(ref.collection('reports').doc(meta.uid), report);
    tx.update(ref, {
      players: FieldValue.arrayUnion(meta.uid),
      state: agreed ? 'agreed' : 'disputed',
      ...(expired ? { stubExpired: true } : {}),
    });
    return 'reported';
  });
}

function isAlreadyExists(error: unknown): boolean {
  // gRPC's ALREADY_EXISTS.
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error.code === 6 || error.code === 'already-exists')
  );
}
