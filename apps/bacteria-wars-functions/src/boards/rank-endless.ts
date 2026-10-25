import {
  atHourOf,
  attemptSeed,
  endlessAttemptId,
  parseAttemptId,
  replayFromBytes,
} from '@wolsok/feat-lazy-bac-game/engine';
import {
  FieldPath,
  FieldValue,
  type Firestore,
  Timestamp,
  type Transaction,
} from 'firebase-admin/firestore';
import { isBanned } from '../limits';
import {
  type AcceptedMatch,
  computeRun,
  type EndlessReason,
  endlessEntryBase,
  type RunAttempt,
  type RunState,
} from './endless-run';
import { entryData, hiddenByOf, memberIn, profileIn } from './entries';
import { checkDeclaredMatch } from './rank-daily';

const DAY_MS = 24 * 3_600_000;
/** How long a run that is not the player's best is kept after its update. */
export const RUN_TTL_MS = 31 * DAY_MS;

/** `endlessRuns/{uid}_{runId}` (ADR 0012), as the functions write it. */
export interface StoredRun extends RunState {
  uid: string;
  runId: string;
  /** The run's level seed: the seed of its match 0. */
  seed: number;
  /** The replays that came, by match index. */
  accepted: Record<string, AcceptedMatch>;
  /** Wins played again and confirmed, from the first. */
  verifiedWins: number;
  /** Where a failed check cut the run, null while it stands whole. */
  cut: number | null;
  /** The run's board `sort`, -1 without a win. */
  sort: number;
}

/** What a run read in a transaction holds - see {@link readRun}. */
export interface RunRead {
  stored: Partial<StoredRun>;
  attempts: RunAttempt[];
}

/** The declared matches of a run and its stored state, in a transaction. */
export async function readRun(
  tx: Transaction,
  db: Firestore,
  uid: string,
  runId: string
): Promise<RunRead> {
  const prefix = `e_${runId}_`;
  const [run, declared] = await Promise.all([
    tx.get(db.doc(`endlessRuns/${uid}_${runId}`)),
    tx.get(
      db
        .collection(`players/${uid}/attempts`)
        .where(FieldPath.documentId(), '>=', prefix)
        .where(FieldPath.documentId(), '<', `${prefix}~`)
    ),
  ]);
  const attempts: RunAttempt[] = [];
  for (const doc of declared.docs) {
    const attempt = parseAttemptId(doc.id);
    const at = doc.get('at');
    if (
      attempt?.kind === 'endless' &&
      attempt.runId === runId &&
      at instanceof Timestamp
    ) {
      attempts.push({ i: attempt.i, at: at.toMillis() });
    }
  }
  return { stored: (run.data() ?? {}) as Partial<StoredRun>, attempts };
}

/**
 * Computes a run again from its attempts and replays and writes it with the
 * player's `endless` entry: their best run that has a win, with the run
 * that held the entry before keeping a TTL once it is no longer the best.
 * Reads before it writes: call it before any write of the transaction.
 */
export async function saveRun(
  tx: Transaction,
  db: Firestore,
  uid: string,
  runId: string,
  read: RunRead,
  change: Partial<Pick<StoredRun, 'accepted' | 'verifiedWins' | 'cut'>>,
  now: number
): Promise<StoredRun | null> {
  const zero = read.attempts.find((attempt) => attempt.i === 0);
  if (zero === undefined) {
    return null;
  }
  const accepted = change.accepted ?? read.stored.accepted ?? {};
  const verifiedWins = change.verifiedWins ?? read.stored.verifiedWins ?? 0;
  const cut = change.cut !== undefined ? change.cut : (read.stored.cut ?? null);
  const seed = attemptSeed(uid, endlessAttemptId(runId, 0), zero.at);
  const state = computeRun(seed, read.attempts, accepted, now);
  const base = endlessEntryBase(state, verifiedWins, cut);
  const run: StoredRun = {
    ...state,
    // A cut run is over: what came after the failed win no longer counts.
    over: state.over || cut !== null,
    pendingAt: cut === null ? state.pendingAt : null,
    uid,
    runId,
    seed,
    accepted,
    verifiedWins,
    cut,
    sort: base?.sort ?? -1,
  };

  const member = await memberIn(tx, db, uid);
  const profile = await profileIn(tx, db, uid);
  const entryRef = db.doc(`boards/endless/entries/${member.entryIds.endless}`);
  const entry = await tx.get(entryRef);
  const others = await tx.get(
    db
      .collection('endlessRuns')
      .where('uid', '==', uid)
      .orderBy('sort', 'desc')
      .limit(2)
  );
  const rival = others.docs.find((doc) => doc.id !== `${uid}_${runId}`);
  const rivalRun = rival?.data() as StoredRun | undefined;
  const best =
    rivalRun !== undefined && rivalRun.sort > run.sort ? rivalRun : run;
  const bestBase =
    best === run
      ? base
      : endlessEntryBase(best, best.verifiedWins ?? 0, best.cut ?? null);

  const runRef = db.doc(`endlessRuns/${uid}_${runId}`);
  // Replaced whole: the best run is written without a TTL.
  tx.set(runRef, {
    ...run,
    updatedAt: FieldValue.serverTimestamp(),
    ...(best === run
      ? {}
      : { expireAt: Timestamp.fromMillis(now + RUN_TTL_MS) }),
  });
  if (rival !== undefined) {
    // The other run keeps its TTL off only while it is the best.
    tx.update(rival.ref, {
      expireAt:
        best === run
          ? Timestamp.fromMillis(now + RUN_TTL_MS)
          : FieldValue.delete(),
    });
  }
  tx.set(
    db.doc(`boardMembers/${uid}`),
    {
      entryIds: member.entryIds,
      boards: FieldValue.arrayUnion('endless'),
      endless: { runId: best.runId },
    },
    { merge: true }
  );
  if (bestBase === null) {
    tx.delete(entryRef);
  } else {
    tx.set(
      entryRef,
      entryData(
        member.entryIds.endless,
        bestBase,
        profile,
        hiddenByOf(entry.get('hiddenBy'))
      )
    );
  }
  return run;
}

/**
 * Takes a new replay of a declared endless match into its run (ADR 0012):
 * the arrival checks (`gpu-int`, seed, ranked plan, timing) here, the level
 * when the run is computed, as it follows from the wins before. A refused
 * replay still costs the match's life; the first replay of a match counts.
 */
export async function rankEndless(
  db: Firestore,
  replayId: string,
  replayDoc: Record<string, unknown>,
  now: number = Date.now()
): Promise<EndlessReason> {
  const uid = (replayDoc['players'] as string[] | undefined)?.[0];
  const attemptId = (replayDoc['attempt'] as { id?: unknown } | undefined)?.id;
  const sent = replayDoc['submittedAt'] ?? replayDoc['createdAt'];
  const arrivedAt = sent instanceof Timestamp ? sent.toMillis() : now;
  const attempt =
    typeof attemptId === 'string' ? parseAttemptId(attemptId) : null;
  const replayRef = db.doc(`replays/${replayId}`);
  const settle = async (reason: EndlessReason) => {
    await replayRef.update({
      rankedReason: reason,
      rankedAt: FieldValue.serverTimestamp(),
    });
    return reason;
  };
  if (
    typeof uid !== 'string' ||
    typeof attemptId !== 'string' ||
    attempt?.kind !== 'endless'
  ) {
    return settle('no-attempt');
  }
  if (await isBanned(db, uid, now)) {
    return settle('banned');
  }
  const declared = (
    await db.doc(`players/${uid}/attempts/${attemptId}`).get()
  ).get('at');
  if (!(declared instanceof Timestamp)) {
    return settle('no-attempt');
  }
  const bytes = (await db.doc(`replays/${replayId}/blob/data`).get()).get(
    'bytes'
  );
  const replay =
    bytes instanceof Uint8Array
      ? await replayFromBytes(new Uint8Array(bytes), { stored: true })
      : null;
  if (replay === null) {
    return settle('unreadable');
  }
  const reason = checkDeclaredMatch(
    replay,
    uid,
    attemptId,
    declared.toMillis(),
    arrivedAt
  );
  const match: AcceptedMatch = {
    replayId,
    levelId: replay.header.levelId,
    won: replay.header.outcome?.winnerSeat === 0,
    ticks: replay.header.ticks,
    reason,
    atHour: atHourOf(arrivedAt),
  };
  return db.runTransaction(async (tx) => {
    const read = await readRun(tx, db, uid, attempt.runId);
    const accepted = read.stored.accepted ?? {};
    if (accepted[String(attempt.i)] !== undefined) {
      tx.update(replayRef, {
        rankedReason: 'duplicate',
        rankedAt: FieldValue.serverTimestamp(),
      });
      return 'duplicate' as const;
    }
    const run = await saveRun(
      tx,
      db,
      uid,
      attempt.runId,
      read,
      { accepted: { ...accepted, [String(attempt.i)]: match } },
      now
    );
    // The level is checked with the run: a match on another level is refused.
    const result = run?.matches.find((m) => m.i === attempt.i)?.result;
    const ranked: EndlessReason =
      run === null
        ? 'no-attempt'
        : reason === 'counted' && result === 'refused'
          ? 'level'
          : reason;
    tx.update(replayRef, {
      rankedReason: ranked,
      rankedAt: FieldValue.serverTimestamp(),
    });
    return ranked;
  });
}

/**
 * Computes a run again in a transaction - the hourly sweep of matches
 * whose replay never came, and verification's changes.
 */
export async function refreshRun(
  db: Firestore,
  uid: string,
  runId: string,
  now: number,
  change: Partial<Pick<StoredRun, 'verifiedWins' | 'cut'>> = {}
): Promise<StoredRun | null> {
  return db.runTransaction(async (tx) =>
    saveRun(tx, db, uid, runId, await readRun(tx, db, uid, runId), change, now)
  );
}

/**
 * The hourly sweep (ADR 0012): runs waiting on a match whose replay has not
 * come 2 hours after its declaration count it as a lost life.
 */
export async function closeStaleMatches(
  db: Firestore,
  now: number
): Promise<number> {
  const stale = await db
    .collection('endlessRuns')
    .where('pendingAt', '<=', now - 2 * 3_600_000)
    .limit(200)
    .get();
  for (const doc of stale.docs) {
    await refreshRun(db, String(doc.get('uid')), String(doc.get('runId')), now);
  }
  return stale.size;
}
