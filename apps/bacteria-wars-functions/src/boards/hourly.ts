import {
  atHourOf,
  dailyBoardId,
  onlineSort,
  utcDay,
} from '@wolsok/feat-lazy-bac-game/engine';
import {
  FieldValue,
  type Firestore,
  Timestamp,
} from 'firebase-admin/firestore';
import { entryData, hiddenByOf, memberIn, profileIn } from './entries';
import { MIN_COUNTED_TICKS } from './rank-online';
import { SLICE_MS } from './budgets';
import { closeStaleMatches } from './rank-endless';
import { verifyEndlessSlice } from './verify-endless';
import { type AccountInfo, verifyDailySlice } from './verify-slice';

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
/** An online replay still `waiting` this long after it came is closed. */
export const NOT_REPORTED_AFTER_MS = 2 * HOUR_MS;
/** How far back the sweep looks: one missed run is caught up, no more. */
const SWEEP_WINDOW_MS = 26 * HOUR_MS;
/** The replays one sweep closes at most. */
const SWEEP_LIMIT = 500;
/** Endings a device reports only after a real match. */
const REGULAR_ENDINGS = ['annihilation', 'time', 'forfeit'];

/**
 * Closes online replays still `waiting` 2 hours after they came (ADR 0012,
 * "Not reported"): with only one report, the match never counts. When that
 * report has a regular ending after at least 30 s, the stub's other player
 * gets `nr + 1` on their online entry - shown, never part of `sort`. The
 * `rankedReplays` marker keeps a late second report from counting it.
 */
export async function closeNotReported(
  db: Firestore,
  now: number
): Promise<number> {
  const waiting = await db
    .collection('replays')
    .where('state', '==', 'waiting')
    .where('createdAt', '>=', Timestamp.fromMillis(now - SWEEP_WINDOW_MS))
    .where('createdAt', '<=', Timestamp.fromMillis(now - NOT_REPORTED_AFTER_MS))
    .orderBy('createdAt', 'asc')
    .limit(SWEEP_LIMIT)
    .get();
  let closed = 0;
  for (const doc of waiting.docs) {
    if (doc.get('kind') === 'online' && (await closeOne(db, doc.id, now))) {
      closed++;
    }
  }
  return closed;
}

async function closeOne(
  db: Firestore,
  replayId: string,
  now: number
): Promise<boolean> {
  return db.runTransaction(async (tx) => {
    const replayRef = db.doc(`replays/${replayId}`);
    const marker = db.doc(`rankedReplays/${replayId}`);
    const replay = await tx.get(replayRef);
    if (replay.get('state') !== 'waiting' || (await tx.get(marker)).exists) {
      return false;
    }
    const reporter = (replay.get('players') as string[] | undefined)?.[0];
    const seats = replay.get('seats') as unknown;
    const other = Array.isArray(seats)
      ? seats.find((uid) => typeof uid === 'string' && uid !== reporter)
      : undefined;
    const regular =
      REGULAR_ENDINGS.includes(String(replay.get('endedBy'))) &&
      Number(replay.get('ticks')) >= MIN_COUNTED_TICKS &&
      replay.get('stubExpired') !== true;
    const counts = regular && typeof other === 'string';
    // Reads first, as a transaction must.
    const member = counts ? await memberIn(tx, db, other) : null;
    const profile = counts ? await profileIn(tx, db, other) : null;
    const entryRef =
      member === null
        ? null
        : db.doc(`boards/online/entries/${member.entryIds.online}`);
    const entry = entryRef === null ? null : await tx.get(entryRef);
    tx.create(marker, {
      at: FieldValue.serverTimestamp(),
      expireAt: Timestamp.fromMillis(now + 31 * DAY_MS),
    });
    tx.update(replayRef, {
      rankedReason: 'not-reported',
      rankedAt: FieldValue.serverTimestamp(),
    });
    if (
      member === null ||
      profile === null ||
      entryRef === null ||
      entry === null ||
      typeof other !== 'string'
    ) {
      return true;
    }
    const show = (entry.get('show') ?? {}) as Record<string, unknown>;
    const n = (key: string) => {
      const x = Number(show[key] ?? 0);
      return Number.isSafeInteger(x) && x >= 0 ? x : 0;
    };
    const record = { w: n('w'), l: n('l'), d: n('d'), nr: n('nr') + 1 };
    const atHour = entry.get('atHour');
    tx.set(
      db.doc(`boardMembers/${other}`),
      { entryIds: member.entryIds, boards: FieldValue.arrayUnion('online') },
      { merge: true }
    );
    tx.set(
      entryRef,
      entryData(
        member.entryIds.online,
        {
          sort: onlineSort(record.w, record.l),
          // `nr` is not part of `sort`: the row keeps its place among ties.
          atHour: typeof atHour === 'number' ? atHour : atHourOf(now),
          baseStatus: 'counted',
          show: record,
        },
        profile,
        hiddenByOf(entry.get('hiddenBy'))
      )
    );
    return true;
  });
}

/**
 * From 23:00 UTC yesterday's daily board is closed (ADR 0012): its top
 * document gets `final: true`, and verification moves on to today alone.
 * Entries still provisional stay marked as such.
 */
export async function finalizeDailyBoards(
  db: Firestore,
  now: number
): Promise<string | null> {
  if (new Date(now).getUTCHours() < 23) {
    return null;
  }
  const boardId = dailyBoardId(utcDay(new Date(now - DAY_MS)));
  const top = db.doc(`boards/${boardId}`);
  if (!(await top.get()).exists) {
    return null;
  }
  await top.update({ final: true });
  return boardId;
}

/**
 * The hourly run (ADR 0012), in order: closes unreported online matches
 * and endless matches whose replay never came, closes yesterday's daily
 * board, then spends the hour's verification slice - the daily boards
 * first, the `endless` board with the rest. Bans and statistics join with
 * their waves.
 */
export async function runHourly(
  db: Firestore,
  now: number,
  accountInfo: (uid: string) => Promise<AccountInfo>
) {
  const notReported = await closeNotReported(db, now);
  const staleRuns = await closeStaleMatches(db, now);
  const finalized = await finalizeDailyBoards(db, now);
  const daily = await verifyDailySlice(db, now, accountInfo);
  const endless = await verifyEndlessSlice(
    db,
    now,
    accountInfo,
    SLICE_MS - daily.spentMs
  );
  return { notReported, staleRuns, finalized, daily, endless };
}
