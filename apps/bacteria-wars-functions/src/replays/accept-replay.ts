import { FieldValue, Firestore, Timestamp } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import type { Attempt, Replay } from '@wolsok/feat-lazy-bac-game/engine';
import { REPLAY_DAYS } from '../config';
import { Engine, loadEngine } from '../engine';
import { isActive, takeDailySubmission, takeHourlySubmission } from '../limits';
import { DAY_MS, HOUR_MS } from '../time';
import { addBlob } from './blob';
import {
  deriveKind,
  inputsHash,
  levelStatsId,
  levelStatsIncrements,
  parseSubmission,
  Submission,
} from './derive';
import type { ReplayDoc, ReplayKind, ReplayReport, ReplayState } from './model';

/** An online replay still `waiting` this long after it was stored is closed. */
export const WAITING_CLOSE_MS = 2 * HOUR_MS;

/** Why a submission was not stored. */
export type DropReason =
  /** Not what the rules let through. */
  | 'invalid'
  | 'banned'
  /** The player's submissions of the hour are used up. */
  | 'hourly-limit'
  /** The day's submissions for everyone are used up. */
  | 'daily-cap'
  /** No whole replay in the bytes, or not one to store. */
  | 'unparsable'
  /** The attempt is unknown, void, or not the replay's. */
  | 'attempt'
  /** A local replay of a match that was not against the computer. */
  | 'not-local'
  /** An evolved replay of a daily or endless match (ADR 0013). */
  | 'evolved'
  /** Online: the room's stub names other players. */
  | 'wrong-room'
  /** Already stored, or already reported by that player. */
  | 'duplicate';

/**
 * The one-time ban tombstone check after a guest linked Google (ADR 0012)
 * - true when it banned the player.
 */
export type GoogleLinkCheck = (uid: string) => Promise<boolean>;

export type AcceptResult =
  | { stored: string; state: ReplayState }
  | { dropped: DropReason };

/**
 * `acceptReplay` (ADR 0011, with the changes of ADR 0012 and ADR 0016):
 * checks a submission and stores its replay - a local one under `l_` and
 * the submission's id, an online one under the id both devices compute,
 * where the second device's report decides `agreed` or `disputed`. No
 * re-run. The submission is deleted whatever happens.
 *
 * A submission of a declared attempt the server drops on its own account
 * - a cap, a limit, an error of ours - marks the attempt `void`, so it is
 * not used up.
 */
export async function acceptSubmission(
  db: Firestore,
  submissionId: string,
  data: Record<string, unknown> | undefined,
  now = Date.now(),
  googleLinkBans: GoogleLinkCheck = async () => false
): Promise<AcceptResult> {
  const submission = parseSubmission(data);
  try {
    if (submission === null) {
      return { dropped: 'invalid' };
    }
    const result = await accept(
      db,
      submissionId,
      submission,
      now,
      googleLinkBans
    );
    if ('dropped' in result) {
      logger.info('Submission dropped', {
        submissionId,
        uid: submission.uid,
        reason: result.dropped,
      });
    }
    return result;
  } catch (error) {
    if (submission?.attempt !== undefined) {
      await voidAttempt(db, submission.uid, submission.attempt, 'error');
    }
    throw error;
  } finally {
    await db.doc(`replaySubmissions/${submissionId}`).delete();
  }
}

async function accept(
  db: Firestore,
  submissionId: string,
  submission: Submission,
  now: number,
  googleLinkBans: GoogleLinkCheck
): Promise<AcceptResult> {
  const { uid } = submission;
  if (!(await isActive(db, uid, now)) || (await googleLinkBans(uid))) {
    return { dropped: 'banned' };
  }
  const engine = await loadEngine();

  const attempt = await readAttempt(db, engine, submission);
  if (attempt === 'invalid') {
    return { dropped: 'attempt' };
  }
  const ranked = attempt !== null;
  const overLimit = !(await takeHourlySubmission(db, uid, now))
    ? 'hourly-limit'
    : !(await takeDailySubmission(db, ranked, now))
      ? 'daily-cap'
      : null;
  if (overLimit !== null) {
    if (attempt !== null) {
      await voidAttempt(db, uid, attempt.id, overLimit);
    }
    return { dropped: overLimit };
  }

  const replay = await engine.replayFromBytes(
    new Uint8Array(submission.bytes),
    { stored: true }
  );
  if (replay === null) {
    return { dropped: 'unparsable' };
  }
  if ((replay.header.attempt?.id ?? null) !== (attempt?.id ?? null)) {
    return { dropped: 'attempt' };
  }
  return replay.header.roomCode === undefined
    ? acceptLocal(db, engine, submissionId, submission, replay, attempt)
    : acceptOnline(db, engine, submission, replay, now);
}

/** A declared attempt as stored for the player. */
interface StoredAttempt {
  id: string;
  parsed: Attempt;
  /** The server's time of the declaration. */
  at: number;
}

/**
 * The submission's attempt as stored - null without one, 'invalid' for one
 * that is unknown, void or not an attempt id.
 */
async function readAttempt(
  db: Firestore,
  engine: Engine,
  submission: Submission
): Promise<StoredAttempt | null | 'invalid'> {
  if (submission.attempt === undefined) {
    return null;
  }
  const parsed = engine.parseAttemptId(submission.attempt);
  if (parsed === null) {
    return 'invalid';
  }
  const doc = await db
    .doc(`players/${submission.uid}/attempts/${submission.attempt}`)
    .get();
  const at = doc.get('at') as Timestamp | undefined;
  if (!doc.exists || at === undefined || doc.get('void') === true) {
    return 'invalid';
  }
  return { id: submission.attempt, parsed, at: at.toMillis() };
}

/**
 * Marks an attempt the server dropped as void: it does not count as used
 * (ADR 0012). Only functions write it; the player may not.
 */
export async function voidAttempt(
  db: Firestore,
  uid: string,
  attemptId: string,
  reason: string
): Promise<void> {
  const ref = db.doc(`players/${uid}/attempts/${attemptId}`);
  try {
    await ref.update({
      void: true,
      voidReason: reason,
      voidedAt: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    logger.warn('Could not void the attempt', { uid, attemptId, error });
  }
}

/** The fields every stored replay has, from its header. */
function replayFields(
  replay: Replay,
  submission: Submission,
  kind: ReplayKind,
  state: ReplayState,
  players: string[]
): ReplayDoc {
  const { header } = replay;
  return {
    players,
    kind,
    levelId: header.levelId,
    difficulty: header.difficulty,
    balanceVersion: header.balanceVersion,
    replayVersion: header.version,
    createdAt: Timestamp.fromMillis(submission.createdAt),
    ticks: header.ticks,
    endedBy: header.outcome?.endedBy ?? 'time',
    winnerSeat: header.outcome?.winnerSeat ?? null,
    hint: Math.round(submission.hint),
    state,
    optOut: [],
    expireAt: Timestamp.fromMillis(submission.createdAt + REPLAY_DAYS * DAY_MS),
  };
}

/**
 * A match against the computer: stored for the player who sent it, with
 * the bot on the other seat, and counted into its level's statistics.
 */
async function acceptLocal(
  db: Firestore,
  engine: Engine,
  submissionId: string,
  submission: Submission,
  replay: Replay,
  attempt: StoredAttempt | null
): Promise<AcceptResult> {
  const { header } = replay;
  if (header.mode !== 'vs-computer') {
    return { dropped: 'not-local' };
  }
  const kind = deriveKind(
    engine,
    header,
    attempt?.parsed ?? null,
    submission.createdAt
  );
  // The stored parse refuses evolution - loadouts or a weapon fired, in
  // version 3, 4 or 5 - in an attempt or at a daily level already; this
  // keeps any other way into a board shut too. Read from what the replay
  // holds: a version 5 replay may be plain, as every ranked attempt is.
  const evolved = engine.playsEvolution(replay);
  if (evolved && kind !== 'computer') {
    return { dropped: 'evolved' };
  }
  const id = `l_${submissionId}`;
  const doc: ReplayDoc = {
    ...replayFields(replay, submission, kind, 'submitted', [submission.uid]),
    ...(attempt === null
      ? {}
      : { attempt: { id: attempt.id, at: attempt.at } }),
  };
  const batch = db.batch();
  batch.create(db.doc(`replays/${id}`), doc);
  addBlob(batch, db, id, submission.bytes, doc.expireAt);
  const increments = levelStatsIncrements(
    replay,
    engine.TICKS_PER_SEC,
    evolved
  );
  batch.set(
    db.doc(`levelStats/${levelStatsId(header, kind)}`),
    {
      levelId: header.levelId,
      difficulty: header.difficulty,
      updatedAt: FieldValue.serverTimestamp(),
      ...nestedIncrements(increments),
    },
    { merge: true }
  );
  try {
    await batch.commit();
  } catch (error) {
    if (isAlreadyExists(error)) {
      return { dropped: 'duplicate' };
    }
    throw error;
  }
  return { stored: id, state: 'submitted' };
}

/**
 * One device's report of an online match. The first stores the replay as
 * `waiting`; the second, from the other player of the room, is compared
 * with it in a transaction: the same checksum and winner make it `agreed`,
 * anything else `disputed`, a dead end. The players are the uids the room's
 * stub names, each added once its own report arrives - nothing a peer said
 * over WebRTC is trusted.
 */
async function acceptOnline(
  db: Firestore,
  engine: Engine,
  submission: Submission,
  replay: Replay,
  now: number
): Promise<AcceptResult> {
  const { header } = replay;
  const { uid } = submission;
  const roomCode = header.roomCode as string;
  const n = header.n as number;
  const id = engine.onlineReplayId(roomCode, n, header.seed);
  const room = await readRoom(db, roomCode, n, now);
  if (room.live && room.host !== uid && room.guest !== uid) {
    return { dropped: 'wrong-room' };
  }
  const report: ReplayReport = {
    checksum: header.checksum as number,
    inputsHash: inputsHash(replay),
    winnerSeat: header.outcome?.winnerSeat ?? null,
    endedBy: header.outcome?.endedBy ?? 'time',
    at: Timestamp.fromMillis(now),
  };
  const replayRef = db.doc(`replays/${id}`);
  return db.runTransaction(async (tx): Promise<AcceptResult> => {
    const stored = await tx.get(replayRef);
    if (!stored.exists) {
      const doc: ReplayDoc = {
        ...replayFields(replay, submission, 'online', 'waiting', [uid]),
        room: {
          code: roomCode,
          n,
          host: room.host,
          guest: room.guest,
          createdAt: room.createdAt,
        },
        bound: room.live,
        closeAt: Timestamp.fromMillis(submission.createdAt + WAITING_CLOSE_MS),
      };
      tx.create(replayRef, doc);
      addBlob(tx, db, id, submission.bytes, doc.expireAt);
      tx.create(db.doc(`replays/${id}/reports/${uid}`), {
        ...report,
        expireAt: doc.expireAt,
      });
      return { stored: id, state: 'waiting' };
    }
    const existing = stored.data() as ReplayDoc;
    if (existing.players.includes(uid) || existing.players.length >= 2) {
      return { dropped: 'duplicate' };
    }
    const named = [existing.room?.host, existing.room?.guest];
    if (existing.room?.host != null && !named.includes(uid)) {
      return { dropped: 'wrong-room' };
    }
    const other = await tx.get(
      db.doc(`replays/${id}/reports/${existing.players[0]}`)
    );
    const agree =
      other.get('checksum') === report.checksum &&
      other.get('winnerSeat') === report.winnerSeat;
    const state: ReplayState =
      existing.state === 'waiting'
        ? agree
          ? 'agreed'
          : 'disputed'
        : existing.state;
    tx.update(replayRef, {
      players: FieldValue.arrayUnion(uid),
      state,
      bound: existing.bound === true && room.live,
      closeAt: FieldValue.delete(),
    });
    tx.create(db.doc(`replays/${id}/reports/${uid}`), {
      ...report,
      ...(existing.expireAt === undefined
        ? {}
        : { expireAt: existing.expireAt }),
    });
    return { stored: id, state };
  });
}

/** What an online match's room says about its players. */
interface RoomInfo {
  /** True while the room - its stub once matched - has not expired. */
  live: boolean;
  host: string | null;
  guest: string | null;
  createdAt: Timestamp | null;
}

/**
 * The room a match was played in, by its code. Once the guest connected
 * the host replaces it with a stub (`taken`) that keeps both uids for up to
 * six hours (ADR 0011). A room answered but not yet replaced names them
 * too. Without a live room, a report is kept for whoever sent it.
 */
async function readRoom(
  db: Firestore,
  code: string,
  n: number,
  now: number
): Promise<RoomInfo> {
  const doc = await db.doc(`rooms/${code}`).get();
  const host = doc.get('host') as unknown;
  const guest = doc.get('guest') as unknown;
  const expireAt = doc.get('expireAt') as Timestamp | undefined;
  const createdAt = (doc.get('createdAt') as Timestamp | undefined) ?? null;
  const named = typeof host === 'string' && typeof guest === 'string';
  const live =
    doc.exists && named && expireAt !== undefined && expireAt.toMillis() > now;
  if (!live) {
    logger.info('Online report without a live room', { code, n });
  }
  return {
    live,
    host: named ? (host as string) : null,
    guest: named ? (guest as string) : null,
    createdAt: named ? createdAt : null,
  };
}

/**
 * Field paths and increments as the nested object `set` merges: `set`
 * takes a dotted key as one field's name, not as a path.
 */
export function nestedIncrements(
  increments: Record<string, number>
): Record<string, unknown> {
  const nested: Record<string, unknown> = {};
  for (const [path, by] of Object.entries(increments)) {
    const [field, key] = path.split('.', 2);
    if (key === undefined) {
      nested[field] = FieldValue.increment(by);
    } else {
      nested[field] = {
        ...(nested[field] as Record<string, unknown> | undefined),
        [key]: FieldValue.increment(by),
      };
    }
  }
  return nested;
}

function isAlreadyExists(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return code === 6 || code === 'already-exists' || code === 'ALREADY_EXISTS';
}
