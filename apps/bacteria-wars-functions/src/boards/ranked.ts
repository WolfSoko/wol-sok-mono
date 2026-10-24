import {
  FieldPath,
  FieldValue,
  Firestore,
  Timestamp,
  Transaction,
} from 'firebase-admin/firestore';
import type { Attempt, RankedReason } from '@wolsok/feat-lazy-bac-game/engine';
import type { Engine } from '../engine';
import { isActive } from '../limits';
import { readStoredReplay } from '../replays/blob';
import { ReplayDoc, verdictOf } from '../replays/model';
import { DAY_MS, HOUR_MS } from '../time';
import {
  dailyExpireAt,
  dailyRunRef,
  endlessRunRef,
  entryRef,
  memberOf,
  memberRef,
  putEntry,
  readStanding,
} from './entries';
import type {
  DailyAttemptRow,
  DailyRunDoc,
  EndlessRunDoc,
  RunMatch,
  RunStatus,
} from './model';

/**
 * Ranked daily and endless matches (ADR 0012): a replay of a declared
 * attempt is checked against the stored attempt - never its header's copy
 * - without re-running it, and taken into the player's day or run. The
 * player's entry is their best attempt or run that has not failed
 * verification, with its status.
 */

/** Days a run that is not the player's best is kept after its last change. */
export const RUN_DAYS = 31;
/** Lives an endless run has - the third lost one ends it. */
export const RUN_LIVES = 3;

/** What taking a ranked replay did. */
export type RankedResult =
  | { taken: 'daily' | 'endless' }
  | { reason: RankedReason }
  | { done: true };

/** The checks a replay of a declared attempt passes before it ranks. */
interface Checked {
  uid: string;
  attemptId: string;
  attempt: Attempt;
  /** The server's time of the declaration. */
  at: number;
  /** Null when it passed every check that does not depend on the run. */
  reason: RankedReason | null;
}

/**
 * Checks a replay against its stored attempt: it exists and is not void,
 * the seed is the declaration's, the plan is the ranked setup, the match
 * started after the declaration and the replay arrived within 5 minutes of
 * its end. Daily: the level is the day's. An endless match's level depends
 * on the run, which {@link updateEndlessRun} checks.
 */
export async function checkRanked(
  db: Firestore,
  engine: Engine,
  replayId: string,
  doc: ReplayDoc,
  now = Date.now()
): Promise<Checked | { reason: RankedReason } | null> {
  const uid = doc.players[0];
  const attemptId = doc.attempt?.id;
  const attempt =
    attemptId === undefined ? null : engine.parseAttemptId(attemptId);
  if (uid === undefined || attemptId === undefined || attempt === null) {
    return null;
  }
  const fail = (reason: RankedReason): Checked => ({
    uid,
    attemptId,
    attempt,
    at: doc.attempt?.at ?? 0,
    reason,
  });
  if (!(await isActive(db, uid, now))) {
    return { reason: 'banned' };
  }
  const stored = await db.doc(`players/${uid}/attempts/${attemptId}`).get();
  const atStamp = stored.get('at') as Timestamp | undefined;
  if (!stored.exists || atStamp === undefined) {
    return { reason: 'no-attempt' };
  }
  if (stored.get('void') === true) {
    return { reason: 'void' };
  }
  const at = atStamp.toMillis();
  const checked: Checked = { uid, attemptId, attempt, at, reason: null };
  const replay = await readStoredReplay(db, engine, replayId);
  if (replay == null) {
    return fail('plan-mismatch');
  }
  const { header } = replay;
  const seed = engine.attemptSeed(uid, attemptId, at);
  const arrived = doc.createdAt.toMillis();
  if (header.seed !== seed) {
    return fail('seed-mismatch');
  }
  if (!engine.isRankedPlan(header)) {
    return fail('plan-mismatch');
  }
  if (
    attempt.kind === 'daily' &&
    header.levelId !== engine.dailyLevelId(attempt.day)
  ) {
    return fail('level-mismatch');
  }
  if (!engine.declaredBeforeMatch(at, header.ticks, arrived)) {
    return fail('early');
  }
  if (arrived > engine.submissionDeadline(at, header.ticks)) {
    return fail('late');
  }
  return checked;
}

/**
 * Takes a stored replay of a declared attempt into the player's day or
 * run - `rankReplay` calls it once the replay is stored. A replay that
 * fails a check gets its `rankedReason`; in endless it is a lost life.
 */
export async function acceptRanked(
  db: Firestore,
  engine: Engine,
  replayId: string,
  doc: ReplayDoc,
  now = Date.now()
): Promise<RankedResult> {
  const checked = await checkRanked(db, engine, replayId, doc, now);
  if (checked === null) {
    return { done: true };
  }
  if (!('attempt' in checked)) {
    await db.doc(`replays/${replayId}`).update({
      rankedReason: checked.reason,
    });
    return { reason: checked.reason };
  }
  if (checked.attempt.kind === 'daily') {
    return acceptDaily(db, engine, replayId, doc, checked, now);
  }
  const result = await updateEndlessRun(
    db,
    engine,
    checked.uid,
    checked.attempt.runId,
    now,
    {
      replayId,
      index: checked.attempt.i,
      reason: checked.reason,
      doc,
    }
  );
  return result ?? { taken: 'endless' };
}

async function acceptDaily(
  db: Firestore,
  engine: Engine,
  replayId: string,
  doc: ReplayDoc,
  checked: Checked,
  now: number
): Promise<RankedResult> {
  const day = (checked.attempt as { day: string }).day;
  const replayRef = db.doc(`replays/${replayId}`);
  if (checked.reason !== null) {
    await replayRef.update({ rankedReason: checked.reason });
    return { reason: checked.reason };
  }
  let result: RankedResult = { taken: 'daily' };
  await updateDailyRun(db, engine, checked.uid, day, now, (rows, tx) => {
    const same = rows.find((row) => row.attemptId === checked.attemptId);
    if (same !== undefined) {
      if (same.replayId !== replayId) {
        tx.update(replayRef, { rankedReason: 'used' });
        result = { reason: 'used' };
      } else {
        result = { done: true };
      }
      return false;
    }
    const won = doc.winnerSeat === 0;
    rows.push({
      attemptId: checked.attemptId,
      replayId,
      sort: engine.dailySort(won, doc.ticks),
      ticks: doc.ticks,
      won,
      atHour: engine.atHourOf(doc.createdAt.toMillis()),
      balanceVersion: doc.balanceVersion,
      // A replay the gallery verified already keeps what it came to.
      state: verdictOf(doc.state) ?? 'provisional',
    });
    tx.update(replayRef, { rankedAt: Timestamp.fromMillis(now) });
    return true;
  });
  return result;
}

/** A daily row's state, stale once the balance changed under a claim. */
function rowStatus(
  engine: Engine,
  row: DailyAttemptRow
): 'verified' | 'provisional' | 'stale' | null {
  if (row.state === 'failed') {
    return null;
  }
  if (row.state === 'verified') {
    return 'verified';
  }
  return row.state === 'stale' || row.balanceVersion !== engine.BALANCE_VERSION
    ? 'stale'
    : 'provisional';
}

/** The best row that has not failed verification. */
export function bestRow(
  engine: Engine,
  rows: readonly DailyAttemptRow[]
): DailyAttemptRow | null {
  return (
    rows
      .filter((row) => rowStatus(engine, row) !== null)
      .sort((a, b) => b.sort - a.sort || a.atHour - b.atHour)[0] ?? null
  );
}

/**
 * Changes the player's day in a transaction and writes their entry on the
 * day's board from its best attempt - or deletes it when none is left.
 * `change` returns false to leave everything as it is.
 */
export async function updateDailyRun(
  db: Firestore,
  engine: Engine,
  uid: string,
  day: string,
  now: number,
  change: (rows: DailyAttemptRow[], tx: Transaction) => boolean
): Promise<DailyAttemptRow | null> {
  const boardId = engine.dailyBoardId(day);
  const runRef = dailyRunRef(db, day, uid);
  return db.runTransaction(async (tx) => {
    const run = await tx.get(runRef);
    const member = memberOf(await tx.get(memberRef(db, uid)));
    const entry = await tx.get(entryRef(db, boardId, member.entryIds.daily));
    const standing = await readStanding(tx, db, uid, now);
    const rows = [...((run.get('attempts') as DailyAttemptRow[]) ?? [])];
    if (!change(rows, tx)) {
      return bestRow(engine, rows);
    }
    const doc: DailyRunDoc = {
      uid,
      day,
      attempts: rows,
      expireAt: dailyExpireAt(day),
    };
    tx.set(runRef, doc);
    const best = bestRow(engine, rows);
    if (best === null || member.barred.includes('daily')) {
      if (entry.exists) {
        tx.delete(entry.ref);
      }
    } else {
      putEntry(tx, db, engine, {
        boardId,
        member,
        standing,
        score: {
          sort: best.sort,
          atHour: best.atHour,
          baseStatus: rowStatus(engine, best) ?? 'provisional',
          show: { ticks: best.ticks, won: best.won },
        },
        now,
      });
      if (best.state === 'verified') {
        member.verifiedBefore = true;
      }
    }
    tx.set(memberRef(db, uid), member);
    return best;
  });
}

/** A replay to take into a run. */
export interface RunReplay {
  replayId: string;
  index: number;
  reason: RankedReason | null;
  doc: Pick<
    ReplayDoc,
    'levelId' | 'ticks' | 'winnerSeat' | 'balanceVersion' | 'state'
  >;
}

/** A run's match as kept, with what the run needs of its replay. */
interface KeptMatch extends RunMatch {
  levelId?: string;
  won?: boolean;
}

/**
 * Recomputes an endless run in a transaction from all its declared
 * attempts (ADR 0012): a match without a replay or a pending submission 2
 * hours after its declaration is a lost life; replays may arrive in any
 * order; each match's level must follow from the run seed and the wins
 * before it. Writes the run, the player's best run, and their entry on the
 * endless board. `change` may mark verification first, and returns false
 * to leave everything as it is - a re-run applied twice writes nothing.
 */
export async function updateEndlessRun(
  db: Firestore,
  engine: Engine,
  uid: string,
  runId: string,
  now: number,
  incoming?: RunReplay,
  change: (run: EndlessRunDoc) => boolean = () => true
): Promise<RankedResult | null> {
  const runRef = endlessRunRef(db, uid, runId);
  const prefix = `e_${runId}_`;
  return db.runTransaction(async (tx): Promise<RankedResult | null> => {
    const runSnap = await tx.get(runRef);
    const attempts = await tx.get(
      db
        .collection(`players/${uid}/attempts`)
        .where(FieldPath.documentId(), '>=', prefix)
        .where(FieldPath.documentId(), '<', `${prefix}~`)
    );
    const pending = await tx.get(
      db.collection('replaySubmissions').where('uid', '==', uid)
    );
    const others = await tx.get(
      db.collection('endlessRuns').where('uid', '==', uid)
    );
    const member = memberOf(await tx.get(memberRef(db, uid)));
    const entry = await tx.get(
      entryRef(db, 'endless', member.entryIds.endless)
    );
    const standing = await readStanding(tx, db, uid, now);

    const stored = runSnap.exists
      ? (runSnap.data() as EndlessRunDoc)
      : undefined;
    const firstId = engine.endlessAttemptId(runId, 0);
    const first = attempts.docs.find((doc) => doc.id === firstId);
    const firstAt = (first?.get('at') as Timestamp | undefined)?.toMillis();
    const seed =
      stored?.seed ??
      (firstAt === undefined
        ? undefined
        : engine.attemptSeed(uid, firstId, firstAt));
    if (seed === undefined) {
      if (incoming !== undefined) {
        tx.update(db.doc(`replays/${incoming.replayId}`), {
          rankedReason: 'no-attempt',
        });
      }
      return { reason: 'no-attempt' };
    }
    const kept = new Map<number, KeptMatch>(
      (stored?.matches ?? []).map((match) => [match.index, { ...match }])
    );
    if (incoming !== undefined) {
      const before = kept.get(incoming.index);
      if (before?.replayId === incoming.replayId) {
        return { done: true };
      }
      if (before?.replayId != null) {
        tx.update(db.doc(`replays/${incoming.replayId}`), {
          rankedReason: 'used',
        });
        return { reason: 'used' };
      }
    }
    const pendingIds = new Set(
      pending.docs.map((doc) => doc.get('attempt') as string | undefined)
    );
    // The run owns every match it has seen, even one whose attempt expired
    // (TTL): an attempt adds only a new index or its void flag, and for an
    // index the run holds, its stored `at` wins, like its seed.
    for (const doc of attempts.docs) {
      const parsed = engine.parseAttemptId(doc.id);
      if (parsed?.kind !== 'endless') {
        continue;
      }
      const isVoid = doc.get('void') === true;
      const known = kept.get(parsed.i);
      if (known === undefined) {
        kept.set(parsed.i, {
          index: parsed.i,
          attemptId: doc.id,
          at: (doc.get('at') as Timestamp).toMillis(),
          replayId: null,
          state: isVoid ? 'void' : 'open',
        });
      } else if (isVoid) {
        known.state = 'void';
      }
    }
    const taken = incoming === undefined ? undefined : kept.get(incoming.index);
    if (incoming !== undefined && taken !== undefined) {
      const verdict = verdictOf(incoming.doc.state);
      Object.assign(taken, {
        replayId: incoming.replayId,
        levelId: incoming.doc.levelId,
        ticks: incoming.doc.ticks,
        won: incoming.doc.winnerSeat === 0,
        balanceVersion: incoming.doc.balanceVersion,
        ...(verdict === 'verified' ? { verified: true } : {}),
        ...(verdict === 'failed' ? { failed: true } : {}),
        ...(incoming.reason === null ? {} : { reason: incoming.reason }),
      });
    }
    const matches = [...kept.values()].sort((a, b) => a.index - b.index);

    const run: EndlessRunDoc = {
      uid,
      runId,
      seed,
      matches,
      ...(stored?.cutAt === undefined ? {} : { cutAt: stored.cutAt }),
      depth: 0,
      seconds: 0,
      status: 'provisional',
      nextCloseAt: null,
      ...(stored?.queued ? { queued: true } : {}),
      best: stored?.best ?? false,
      updatedAt: Timestamp.fromMillis(now),
    };
    if (!change(run)) {
      return null;
    }
    const reasons = computeRun(engine, run, pendingIds, now);
    for (const [replayId, reason] of reasons) {
      tx.update(db.doc(`replays/${replayId}`), { rankedReason: reason });
    }
    if (incoming !== undefined && !reasons.has(incoming.replayId)) {
      // A replay that failed a check is a lost life and keeps its reason.
      tx.update(
        db.doc(`replays/${incoming.replayId}`),
        incoming.reason === null
          ? { rankedAt: Timestamp.fromMillis(now) }
          : { rankedReason: incoming.reason }
      );
    }

    // The player's best run: the entry follows it, it keeps no expireAt.
    const runs = new Map<string, EndlessRunDoc>(
      others.docs.map((doc) => [doc.id, doc.data() as EndlessRunDoc])
    );
    runs.set(runRef.id, run);
    const ranked = [...runs.entries()]
      .filter(([, other]) => other.depth > 0)
      .sort(
        ([, a], [, b]) =>
          engine.endlessSort(b.depth, b.seconds) -
            engine.endlessSort(a.depth, a.seconds) ||
          a.updatedAt.toMillis() - b.updatedAt.toMillis()
      );
    const bestId = ranked[0]?.[0] ?? null;
    for (const [id, other] of runs) {
      const best = id === bestId;
      if (id === runRef.id) {
        run.best = best;
        continue;
      }
      if (other.best !== best) {
        tx.update(db.doc(`endlessRuns/${id}`), {
          best,
          expireAt: best
            ? FieldValue.delete()
            : Timestamp.fromMillis(now + RUN_DAYS * DAY_MS),
        });
      }
    }
    tx.set(runRef, {
      ...run,
      ...(run.best
        ? {}
        : { expireAt: Timestamp.fromMillis(now + RUN_DAYS * DAY_MS) }),
    });

    const best = bestId === null ? null : (runs.get(bestId) ?? null);
    if (best === null || member.barred.includes('endless')) {
      if (entry.exists) {
        tx.delete(entry.ref);
      }
    } else {
      const previous = entry.exists
        ? (entry.data() as { sort: number; atHour: number })
        : null;
      const sort = engine.endlessSort(best.depth, best.seconds);
      putEntry(tx, db, engine, {
        boardId: 'endless',
        member,
        standing,
        score: {
          sort,
          atHour:
            previous !== null && previous.sort === sort
              ? previous.atHour
              : engine.atHourOf(now),
          baseStatus: best.status,
          show: {
            depth: best.depth,
            seconds: best.seconds,
            ...(best.cutAt === undefined ? {} : { partial: true }),
          },
        },
        now,
      });
      if (best.status === 'verified') {
        member.verifiedBefore = true;
      }
    }
    tx.set(memberRef(db, uid), member);
    return null;
  });
}

/**
 * Works out a run from its matches in order, in place: the wins before the
 * third lost life, the seconds they took, the verified prefix (its status)
 * and the cut, and when the next open match closes. Returns the ranked reasons of
 * replays newly found not to rank (a level that does not follow).
 */
export function computeRun(
  engine: Engine,
  run: EndlessRunDoc,
  pending: ReadonlySet<string | undefined>,
  now: number
): Map<string, RankedReason> {
  const reasons = new Map<string, RankedReason>();
  let wins = 0;
  let lost = 0;
  let seconds = 0;
  let blocked = false;
  let nextClose = Number.POSITIVE_INFINITY;
  let verifiedPrefix = true;
  let verifiedWins = 0;
  let stale = false;
  for (const match of run.matches as KeptMatch[]) {
    if (match.state === 'void') {
      continue;
    }
    if (
      lost >= RUN_LIVES ||
      blocked ||
      (run.cutAt !== undefined && wins >= run.cutAt)
    ) {
      match.state = 'after';
      continue;
    }
    if (match.replayId !== null && match.levelId !== undefined) {
      if (
        match.reason === undefined &&
        match.levelId !==
          engine.endlessLevelId({ seed: run.seed, wins, lives: 0 })
      ) {
        match.reason = 'level-mismatch';
        reasons.set(match.replayId, 'level-mismatch');
      }
      if (match.reason === undefined && match.won === true && match.failed) {
        // A win whose re-run failed: the run ends at its verified prefix.
        run.cutAt = wins;
        match.state = 'after';
        blocked = true;
        continue;
      }
      if (match.reason === undefined && match.won === true) {
        match.state = 'won';
        wins++;
        seconds += Math.round((match.ticks ?? 0) / engine.TICKS_PER_SEC);
        verifiedPrefix = verifiedPrefix && match.verified === true;
        if (verifiedPrefix) {
          verifiedWins++;
        } else if (
          match.balanceVersion !== engine.BALANCE_VERSION ||
          match.gone === true
        ) {
          stale = true;
        }
      } else {
        match.state = 'lost';
        lost++;
      }
      continue;
    }
    const closesAt = match.at + engine.ATTEMPT_CLOSE_MS;
    if (pending.has(match.attemptId)) {
      match.state = 'open';
      blocked = true;
      nextClose = Math.min(nextClose, now + HOUR_MS);
    } else if (now < closesAt) {
      match.state = 'open';
      blocked = true;
      nextClose = Math.min(nextClose, closesAt);
    } else {
      match.state = 'lost';
      lost++;
    }
  }
  run.depth = wins;
  run.seconds = seconds;
  run.nextCloseAt = Number.isFinite(nextClose)
    ? Timestamp.fromMillis(nextClose)
    : null;
  const status: RunStatus =
    verifiedWins === wins ? 'verified' : stale ? 'stale' : 'provisional';
  run.status = status;
  return reasons;
}

/** The kind of a stored replay's board, from its attempt - null without one. */
export function rankedKind(
  engine: Engine,
  doc: Pick<ReplayDoc, 'attempt'>
): 'daily' | 'endless' | null {
  const parsed =
    doc.attempt === undefined ? null : engine.parseAttemptId(doc.attempt.id);
  return parsed?.kind ?? null;
}
