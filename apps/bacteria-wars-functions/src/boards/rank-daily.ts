import {
  atHourOf,
  attemptSeed,
  dailyBoardId,
  dailyLevelId,
  dailySort,
  declaredBeforeMatch,
  isRankedPlan,
  parseAttemptId,
  type Replay,
  replayFromBytes,
  submissionDeadline,
} from '@wolsok/feat-lazy-bac-game/engine';
import {
  FieldValue,
  type Firestore,
  Timestamp,
  type Transaction,
} from 'firebase-admin/firestore';
import { isBanned } from '../limits';
import {
  type EntryBase,
  entryData,
  hiddenByOf,
  memberIn,
  profileIn,
} from './entries';

const DAY_MS = 24 * 3_600_000;
/** How long daily boards, their entries and runs are kept. */
export const DAILY_TTL_MS = 31 * DAY_MS;

/** Why a ranked daily replay did (not) rank - its `rankedReason`. */
export type DailyReason =
  | DeclaredReason
  | 'banned'
  | 'no-attempt'
  | 'duplicate'
  | 'unreadable';

/** One declared attempt of a player's day, as `dailyRuns` keeps it. */
export interface DailyAttemptRun {
  attemptId: string;
  replayId: string;
  sort: number;
  won: boolean;
  ticks: number;
  /** `provisional` until the hourly function played it again. */
  state: 'provisional' | 'verified' | 'unverified' | 'balance-mismatch';
  /** The hour its score was reached. */
  atHour: number;
}

/** What {@link checkDeclaredMatch} finds. */
export type DeclaredReason =
  | 'counted'
  | 'ruleset'
  | 'seed'
  | 'plan-mismatch'
  | 'level'
  | 'early'
  | 'late';

/**
 * The checks every declared match passes (ADR 0012), always against the
 * stored declaration, never the header's copy of `at`: the owner's
 * decision that ranked matches are `gpu-int` only (ADR 0015); the seed
 * from the declaration; exactly the ranked plan; the level, when the
 * caller knows it already; a declaration before the match; an upload
 * within its deadline.
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

/** {@link checkDeclaredMatch} for a daily attempt: that day's daily level. */
export function checkDailyAttempt(
  replay: Replay,
  uid: string,
  attemptId: string,
  declaredAt: number,
  arrivedAt: number
): DailyReason {
  const attempt = parseAttemptId(attemptId);
  return attempt?.kind !== 'daily'
    ? 'no-attempt'
    : checkDeclaredMatch(
        replay,
        uid,
        attemptId,
        declaredAt,
        arrivedAt,
        dailyLevelId(attempt.day)
      );
}

/**
 * A player's entry on a daily board: their best attempt that has not
 * failed a check, with that attempt's status - null when none is left.
 */
export function dailyEntryBase(
  attempts: readonly DailyAttemptRun[]
): EntryBase | null {
  const best = attempts
    .filter((a) => a.state === 'provisional' || a.state === 'verified')
    .sort((a, b) => b.sort - a.sort || a.atHour - b.atHour)[0];
  if (best === undefined) {
    return null;
  }
  return {
    sort: best.sort,
    atHour: best.atHour,
    baseStatus: best.state === 'verified' ? 'verified' : 'provisional',
    show: { ticks: best.ticks, won: best.won },
  };
}

/**
 * Takes a new replay of a declared daily attempt into the player's day
 * (`dailyRuns/{day}_{uid}`) and their entry on `daily-{day}`, provisional
 * until the hourly function plays it again. The first replay of an
 * attempt counts; a replay that fails the checks is stored but never
 * ranks, and says why in `rankedReason`.
 */
export async function rankDaily(
  db: Firestore,
  replayId: string,
  replayDoc: Record<string, unknown>,
  now: number = Date.now()
): Promise<DailyReason> {
  const uid = (replayDoc['players'] as string[] | undefined)?.[0];
  const attemptId = (replayDoc['attempt'] as { id?: unknown } | undefined)?.id;
  // The submission's `createdAt` (request.time), else the replay's own.
  const sent = replayDoc['submittedAt'] ?? replayDoc['createdAt'];
  const createdAt = sent instanceof Timestamp ? sent.toMillis() : now;
  const attempt =
    typeof attemptId === 'string' ? parseAttemptId(attemptId) : null;
  const decide = async (): Promise<
    | { reason: DailyReason }
    | { reason: 'counted'; run: DailyAttemptRun; day: string; uid: string }
  > => {
    if (
      typeof uid !== 'string' ||
      attempt?.kind !== 'daily' ||
      typeof attemptId !== 'string'
    ) {
      return { reason: 'no-attempt' };
    }
    if (await isBanned(db, uid, now)) {
      return { reason: 'banned' };
    }
    const declared = await db.doc(`players/${uid}/attempts/${attemptId}`).get();
    const at = declared.get('at');
    if (!(at instanceof Timestamp)) {
      return { reason: 'no-attempt' };
    }
    const bytes = (await db.doc(`replays/${replayId}/blob/data`).get()).get(
      'bytes'
    );
    const replay =
      bytes instanceof Uint8Array
        ? await replayFromBytes(new Uint8Array(bytes), { stored: true })
        : null;
    if (replay === null) {
      return { reason: 'unreadable' };
    }
    const reason = checkDailyAttempt(
      replay,
      uid,
      attemptId,
      at.toMillis(),
      createdAt
    );
    if (reason !== 'counted') {
      return { reason };
    }
    const won = replay.header.outcome?.winnerSeat === 0;
    return {
      reason,
      day: attempt.day,
      uid,
      run: {
        attemptId,
        replayId,
        sort: dailySort(won, replay.header.ticks),
        won,
        ticks: replay.header.ticks,
        state: 'provisional',
        atHour: atHourOf(createdAt),
      },
    };
  };
  const decided = await decide();
  const replayRef = db.doc(`replays/${replayId}`);
  if (decided.reason !== 'counted' || !('run' in decided)) {
    await replayRef.update({
      rankedReason: decided.reason,
      rankedAt: FieldValue.serverTimestamp(),
    });
    return decided.reason;
  }
  const { day, run } = decided;
  return db.runTransaction(async (tx) => {
    const runRef = db.doc(`dailyRuns/${day}_${decided.uid}`);
    const stored = await tx.get(runRef);
    const attempts =
      (stored.get('attempts') as DailyAttemptRun[] | undefined) ?? [];
    if (attempts.some((a) => a.attemptId === run.attemptId)) {
      tx.update(replayRef, {
        rankedReason: 'duplicate',
        rankedAt: FieldValue.serverTimestamp(),
      });
      return 'duplicate' as const;
    }
    const next = [...attempts, run];
    await writeDailyEntry(tx, db, day, decided.uid, next, now);
    tx.set(runRef, {
      attempts: next,
      expireAt: Timestamp.fromMillis(now + DAILY_TTL_MS),
    });
    tx.update(replayRef, {
      rankedReason: 'counted',
      rankedAt: FieldValue.serverTimestamp(),
    });
    return 'counted' as const;
  });
}

/**
 * Writes a player's entry on `daily-{day}` from their attempts - and takes
 * it off the board when no attempt is left that has not failed a check.
 * Reads before it writes, as a transaction must: call it before the
 * caller's own writes.
 */
export async function writeDailyEntry(
  tx: Transaction,
  db: Firestore,
  day: string,
  uid: string,
  attempts: readonly DailyAttemptRun[],
  now: number
): Promise<void> {
  const boardId = dailyBoardId(day);
  const member = await memberIn(tx, db, uid);
  const profile = await profileIn(tx, db, uid);
  const entryRef = db.doc(`boards/${boardId}/entries/${member.entryIds.daily}`);
  const entry = await tx.get(entryRef);
  const base = dailyEntryBase(attempts);
  tx.set(
    db.doc(`boardMembers/${uid}`),
    { entryIds: member.entryIds, boards: FieldValue.arrayUnion(boardId) },
    { merge: true }
  );
  if (base === null) {
    tx.delete(entryRef);
    return;
  }
  tx.set(entryRef, {
    ...entryData(
      member.entryIds.daily,
      base,
      profile,
      hiddenByOf(entry.get('hiddenBy'))
    ),
    expireAt: Timestamp.fromMillis(now + DAILY_TTL_MS),
  });
}
