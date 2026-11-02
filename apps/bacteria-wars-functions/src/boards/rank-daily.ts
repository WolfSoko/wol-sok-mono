import {
  atHourOf,
  dailyBoardId,
  dailyLevelId,
  dailySort,
  parseAttemptId,
  parseBoardId,
  type Replay,
} from '@wolsok/feat-lazy-bac-game/engine';
import {
  type Firestore,
  Timestamp,
  type Transaction,
} from 'firebase-admin/firestore';
import { DAY_MS } from './budgets';
import {
  type ArrivalReason,
  answerReplay,
  checkDeclaredMatch,
  earlierAnswer,
  namesPlayer,
  rankedFields,
  readDeclaredReplay,
} from './declared-match';
import {
  type EntryBase,
  entryData,
  hiddenFor,
  memberIn,
  profileIn,
} from './entries';

/** How long daily boards, their entries and runs are kept. */
export const DAILY_TTL_MS = 31 * DAY_MS;

/**
 * When a daily board's entries and its top document expire: 31 days after
 * its day, counted from the day rather than the last write, so nothing
 * outlives the board.
 */
export function dailyBoardExpiresAt(day: string): number {
  return Date.parse(day) + DAILY_TTL_MS;
}

/** Why a ranked daily replay did (not) rank - its `rankedReason`. */
export type DailyReason = ArrivalReason;

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
 * ranks, and says why in `rankedReason`. `replayDoc` is the stored
 * replay, read after the event; the transaction checks again that it is
 * still there and unanswered (`gone`, or its earlier answer).
 */
export async function rankDaily(
  db: Firestore,
  replayId: string,
  replayDoc: Record<string, unknown>,
  now: number = Date.now()
): Promise<DailyReason | 'gone'> {
  const read = await readDeclaredReplay(db, replayId, replayDoc, 'daily', now);
  const reason =
    'reason' in read
      ? read.reason
      : checkDeclaredMatch(
          read.replay,
          read.uid,
          read.attemptId,
          read.declaredAt,
          read.arrivedAt,
          dailyLevelId(read.attempt.day)
        );
  if ('reason' in read || reason !== 'counted') {
    return answerReplay(db, replayId, reason);
  }
  const { header } = read.replay;
  const won = header.outcome?.winnerSeat === 0;
  const day = read.attempt.day;
  const { uid } = read;
  const run: DailyAttemptRun = {
    attemptId: read.attemptId,
    replayId,
    sort: dailySort(won, header.ticks),
    won,
    ticks: header.ticks,
    state: 'provisional',
    atHour: atHourOf(read.arrivedAt),
  };
  return db.runTransaction(async (tx) => {
    const replayRef = db.doc(`replays/${replayId}`);
    const runRef = db.doc(`dailyRuns/${day}_${uid}`);
    const [replay, stored] = await tx.getAll(replayRef, runRef);
    if (!namesPlayer(replay, uid)) {
      return 'gone';
    }
    const earlier = earlierAnswer(replay);
    if (earlier !== null) {
      return earlier;
    }
    const attempts =
      (stored.get('attempts') as DailyAttemptRun[] | undefined) ?? [];
    if (attempts.some((a) => a.attemptId === run.attemptId)) {
      tx.update(replayRef, rankedFields('duplicate'));
      return 'duplicate' as const;
    }
    const next = [...attempts, run];
    await writeDailyEntry(tx, db, day, uid, next);
    tx.set(runRef, {
      attempts: next,
      expireAt: Timestamp.fromMillis(dailyBoardExpiresAt(day)),
    });
    tx.update(replayRef, rankedFields('counted'));
    return 'counted' as const;
  });
}

/**
 * Writes a player's entry on `daily-{day}` from their attempts - and takes
 * it off the board when no attempt is left that has not failed a check.
 * The player's `boardMembers.boards` drops the daily boards TTL has taken
 * by then, so it holds the all-time boards and about 31 daily ones. Reads
 * before it writes, as a transaction must: call it before the caller's own
 * writes.
 */
export async function writeDailyEntry(
  tx: Transaction,
  db: Firestore,
  day: string,
  uid: string,
  attempts: readonly DailyAttemptRun[]
): Promise<void> {
  const boardId = dailyBoardId(day);
  const member = await memberIn(tx, db, uid);
  const profile = await profileIn(tx, db, uid);
  const entryRef = db.doc(`boards/${boardId}/entries/${member.entryIds.daily}`);
  const entry = await tx.get(entryRef);
  const base = dailyEntryBase(attempts);
  const listed = member.data['boards'];
  const boards = (Array.isArray(listed) ? listed : []).filter((id) => {
    const board = typeof id === 'string' ? parseBoardId(id) : null;
    return (
      board !== null &&
      id !== boardId &&
      (board.kind !== 'daily' ||
        dailyBoardExpiresAt(board.day) > Date.parse(day))
    );
  });
  tx.set(
    db.doc(`boardMembers/${uid}`),
    { entryIds: member.entryIds, boards: [...boards, boardId] },
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
      hiddenFor(member.data, 'daily', entry.get('hiddenBy'))
    ),
    expireAt: Timestamp.fromMillis(dailyBoardExpiresAt(day)),
  });
}
