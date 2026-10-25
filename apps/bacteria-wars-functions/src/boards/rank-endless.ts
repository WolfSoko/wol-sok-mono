import {
  atHourOf,
  attemptSeed,
  endlessAttemptId,
  parseAttemptId,
  type ReplayHeader,
} from '@wolsok/feat-lazy-bac-game/engine';
import {
  FieldPath,
  FieldValue,
  type Firestore,
  Timestamp,
  type Transaction,
} from 'firebase-admin/firestore';
import { countRerun } from '../replays/level-stats';
import { DAY_MS } from './budgets';
import {
  answerReplay,
  checkDeclaredMatch,
  earlierAnswer,
  rankedFields,
  readDeclaredReplay,
} from './declared-match';
import {
  type AcceptedMatch,
  computeRun,
  type EndlessReason,
  endlessEntryBase,
  LOST_AFTER_MS,
  type RunAttempt,
  type RunState,
  winsOf,
} from './endless-run';
import { entryData, hiddenFor, memberIn, profileIn } from './entries';
import { type Verdict } from './verify';
import { recordCheck, verdictFields } from './verify-slice';

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
  /**
   * Every declared match the run has seen, by index: the server's time of
   * each. Kept here, so an attempt TTL takes from `players/{uid}/attempts`
   * cannot give a lost life back.
   */
  declared: Record<string, number>;
  /** Wins played again and confirmed, from the first. */
  verifiedWins: number;
  /** Where a failed check cut the run, null while it stands whole. */
  cut: number | null;
  /** The run's board `sort`, -1 without a win. */
  sort: number;
  /** Set while the run is not the player's best. */
  expireAt?: Timestamp;
}

/** What a run read in a transaction holds - see {@link readRun}. */
export interface RunRead {
  stored: Partial<StoredRun>;
  /** The matches that count as played: a void one is left out. */
  attempts: RunAttempt[];
  /** The run's level seed - undefined for a run never declared. */
  seed?: number;
}

/**
 * The declared matches of a run and its stored state, in a transaction. A
 * void match (`voidAttempt`) counts as never declared; match 0 still gives
 * the run its seed.
 */
export async function readRun(
  tx: Transaction,
  db: Firestore,
  uid: string,
  runId: string
): Promise<RunRead> {
  // `e_<runId>_`: every match of the run, and nothing else.
  const prefix = endlessAttemptId(runId, 0).slice(0, -1);
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
  const seen = new Set<number>();
  let zeroAt: number | undefined;
  for (const doc of declared.docs) {
    const attempt = parseAttemptId(doc.id);
    const at = doc.get('at');
    if (
      attempt?.kind === 'endless' &&
      attempt.runId === runId &&
      at instanceof Timestamp
    ) {
      seen.add(attempt.i);
      if (attempt.i === 0) {
        zeroAt = at.toMillis();
      }
      if (doc.get('void') !== true) {
        attempts.push({ i: attempt.i, at: at.toMillis() });
      }
    }
  }
  const stored = (run.data() ?? {}) as Partial<StoredRun>;
  for (const [i, at] of Object.entries(stored.declared ?? {})) {
    if (!seen.has(Number(i))) {
      attempts.push({ i: Number(i), at });
    }
  }
  zeroAt ??= stored.declared?.['0'];
  const seed =
    stored.seed ??
    (zeroAt === undefined
      ? undefined
      : attemptSeed(uid, endlessAttemptId(runId, 0), zeroAt));
  return { stored, attempts, ...(seed === undefined ? {} : { seed }) };
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
  const { seed } = read;
  if (seed === undefined) {
    return null;
  }
  const accepted = change.accepted ?? read.stored.accepted ?? {};
  const verifiedWins = change.verifiedWins ?? read.stored.verifiedWins ?? 0;
  const cut = change.cut !== undefined ? change.cut : (read.stored.cut ?? null);
  const state = computeRun(seed, read.attempts, accepted, now);
  const base = endlessEntryBase(state, verifiedWins, cut);
  const run: StoredRun = {
    ...state,
    // Without the void matches: once TTL takes one, it is still not played.
    declared: Object.fromEntries(
      read.attempts.map((attempt) => [String(attempt.i), attempt.at])
    ),
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

  const [member, profile, others] = await Promise.all([
    memberIn(tx, db, uid),
    profileIn(tx, db, uid),
    tx.get(
      db
        .collection('endlessRuns')
        .where('uid', '==', uid)
        .orderBy('sort', 'desc')
        .limit(2)
    ),
  ]);
  const entryRef = db.doc(`boards/endless/entries/${member.entryIds.endless}`);
  const entry = await tx.get(entryRef);
  const rival = others.docs.find((doc) => doc.id !== `${uid}_${runId}`);
  const rivalRun = rival?.data() as StoredRun | undefined;
  const best =
    rivalRun !== undefined && rivalRun.sort > run.sort ? rivalRun : run;
  // Only a run on the board goes without a TTL.
  const keep = best === run && run.sort >= 0;
  const bestBase =
    best === run
      ? base
      : endlessEntryBase(best, best.verifiedWins ?? 0, best.cut ?? null);

  const runRef = db.doc(`endlessRuns/${uid}_${runId}`);
  // Replaced whole: the best run is written without a TTL.
  tx.set(runRef, {
    ...run,
    updatedAt: FieldValue.serverTimestamp(),
    ...(keep ? {} : { expireAt: Timestamp.fromMillis(now + RUN_TTL_MS) }),
  });
  if (rival !== undefined && rivalRun !== undefined) {
    // The other run goes without a TTL only while it is the best; one that
    // already has one keeps it, rather than have it pushed out again.
    if (best === run && rivalRun.expireAt === undefined) {
      tx.update(rival.ref, {
        expireAt: Timestamp.fromMillis(now + RUN_TTL_MS),
      });
    } else if (best !== run && rivalRun.expireAt !== undefined) {
      tx.update(rival.ref, { expireAt: FieldValue.delete() });
    }
  }
  const boards = member.data['boards'];
  const listed =
    !member.fresh &&
    Array.isArray(boards) &&
    boards.includes('endless') &&
    (member.data['endless'] as { runId?: unknown } | undefined)?.runId ===
      best.runId;
  if (!listed) {
    tx.set(
      db.doc(`boardMembers/${uid}`),
      {
        entryIds: member.entryIds,
        boards: FieldValue.arrayUnion('endless'),
        endless: { runId: best.runId },
      },
      { merge: true }
    );
  }
  // Every entry write wakes rebuildTop: write only what changed.
  if (bestBase === null) {
    if (entry.exists) {
      tx.delete(entryRef);
    }
  } else {
    const next = entryData(
      member.entryIds.endless,
      bestBase,
      profile,
      hiddenFor(member.data, 'endless', entry.get('hiddenBy'))
    );
    if (!entry.exists || !sameEntry(next, entry.data() ?? {})) {
      tx.set(entryRef, next);
    }
  }
  return run;
}

/** True when a stored entry already shows what `next` would write. */
function sameEntry(
  next: Record<string, unknown>,
  stored: Record<string, unknown>
): boolean {
  const shown = (entry: Record<string, unknown>) =>
    JSON.stringify(
      Object.keys(entry)
        .filter((key) => key !== 'updatedAt')
        .sort()
        .map((key) => [key, entry[key]])
    );
  return shown(next) === shown(stored);
}

/**
 * Takes a new replay of a declared endless match into its run (ADR 0012):
 * the arrival checks (`gpu-int`, seed, ranked plan, timing) here, the level
 * when the run is computed, as it follows from the wins before. A refused
 * replay still costs the match's life; the first replay of a match counts.
 * `rankedReason` says what was known when it came: `counted` means it
 * passed the checks, while what the match did to the run lives in the run
 * (`matches`), which may wait for an earlier match's replay. Like
 * `rankDaily`, it leaves a replay that is gone or answered already.
 */
export async function rankEndless(
  db: Firestore,
  replayId: string,
  replayDoc: Record<string, unknown>,
  now: number = Date.now()
): Promise<EndlessReason | 'gone'> {
  const replayRef = db.doc(`replays/${replayId}`);
  const read = await readDeclaredReplay(
    db,
    replayId,
    replayDoc,
    'endless',
    now
  );
  if ('reason' in read) {
    return answerReplay(db, replayId, read.reason);
  }
  const { uid, attempt, replay } = read;
  const reason = checkDeclaredMatch(
    replay,
    uid,
    read.attemptId,
    read.declaredAt,
    read.arrivedAt
  );
  const match: AcceptedMatch = {
    replayId,
    levelId: replay.header.levelId,
    won: replay.header.outcome?.winnerSeat === 0,
    ticks: replay.header.ticks,
    reason,
    atHour: atHourOf(read.arrivedAt),
    balanceVersion: replay.header.balanceVersion,
  };
  return db.runTransaction(async (tx) => {
    const [replayNow, runRead] = await Promise.all([
      tx.get(replayRef),
      readRun(tx, db, uid, attempt.runId),
    ]);
    const earlier = earlierAnswer(replayNow);
    if (earlier !== null) {
      return earlier;
    }
    const accepted = runRead.stored.accepted ?? {};
    if (accepted[String(attempt.i)] !== undefined) {
      tx.update(replayRef, rankedFields('duplicate'));
      return 'duplicate' as const;
    }
    const run = await saveRun(
      tx,
      db,
      uid,
      attempt.runId,
      runRead,
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
    tx.update(replayRef, rankedFields(ranked));
    return ranked;
  });
}

/**
 * Computes a run again in a transaction - after a new declaration, and in
 * the hourly sweep of matches whose replay never came.
 */
export async function refreshRun(
  db: Firestore,
  uid: string,
  runId: string,
  now: number
): Promise<StoredRun | null> {
  return db.runTransaction(async (tx) =>
    saveRun(tx, db, uid, runId, await readRun(tx, db, uid, runId), {}, now)
  );
}

/**
 * A new declared endless match joins its run at once (ADR 0012), so the
 * hourly sweep counts it lost when its replay never comes - not only once
 * another replay of the run arrives.
 */
export async function trackDeclaredMatch(
  db: Firestore,
  uid: string,
  attemptId: string,
  now: number
): Promise<StoredRun | null> {
  const attempt = parseAttemptId(attemptId);
  return attempt?.kind === 'endless'
    ? refreshRun(db, uid, attempt.runId, now)
    : null;
}

/**
 * Applies a check of one win (ADR 0012): verified moves the run on by a
 * win, unverified cuts it to its verified prefix, a balance mismatch
 * changes nothing. It holds only while that replay is still the run's next
 * unconfirmed win - null when the run changed meanwhile. The replay and
 * the account's moderation counters are written in the same transaction.
 */
export async function applyVerdict(
  db: Firestore,
  uid: string,
  runId: string,
  replayId: string,
  verdict: Verdict,
  now: number,
  /** The replay played, for the level statistics; absent without one. */
  header?: ReplayHeader
): Promise<StoredRun | null> {
  const moderationRef = db.doc(`moderation/${uid}`);
  return db.runTransaction(async (tx) => {
    const [read, moderation] = await Promise.all([
      readRun(tx, db, uid, runId),
      tx.get(moderationRef),
    ]);
    const verifiedWins = read.stored.verifiedWins ?? 0;
    const next = winsOf({ matches: read.stored.matches ?? [] })[verifiedWins];
    if ((read.stored.cut ?? null) !== null || next?.replayId !== replayId) {
      return null;
    }
    const change =
      verdict.state === 'verified'
        ? { verifiedWins: verifiedWins + 1 }
        : verdict.state === 'unverified'
          ? { cut: verifiedWins }
          : {};
    const run = await saveRun(tx, db, uid, runId, read, change, now);
    tx.update(db.doc(`replays/${replayId}`), verdictFields(verdict));
    if (header !== undefined) {
      countRerun(tx, db, header, 'endless', verdict);
    }
    recordCheck(tx, moderationRef, moderation.data() ?? {}, verdict.state, now);
    return run;
  });
}

/** Runs refreshed side by side in the hourly sweep. */
const SWEEP_PARALLEL = 10;

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
    .where('pendingAt', '<=', now - LOST_AFTER_MS)
    .select('uid', 'runId')
    .limit(200)
    .get();
  for (let i = 0; i < stale.docs.length; i += SWEEP_PARALLEL) {
    await Promise.all(
      stale.docs
        .slice(i, i + SWEEP_PARALLEL)
        .map((doc) =>
          refreshRun(db, String(doc.get('uid')), String(doc.get('runId')), now)
        )
    );
  }
  return stale.size;
}
