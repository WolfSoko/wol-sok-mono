import { atHourOf, dailyBoardId } from '@wolsok/feat-lazy-bac-game/engine';
import {
  FieldValue,
  type Firestore,
  type Query,
  Timestamp,
} from 'firebase-admin/firestore';
import { DAY_MS } from '../boards/budgets';
import { dayOf, dayStart } from '../limits';
import { ACCOUNTS_DOC } from './accounts';
import type { Realtime } from './realtime';

/** How long an hourly snapshot is kept: 90 days, then TTL. */
export const SNAPSHOT_TTL_MS = 90 * DAY_MS;
/** A queue entry not seen for this long has left. */
const QUEUE_SEEN_MS = 45_000;
const HOUR_MS = 3_600_000;

/** The overview's figures (ADR 0012): counters and `count()`s, no scans. */
export interface AdminStats {
  accounts: number;
  active24h: number;
  active7d: number;
  online: number;
  playing: number;
  searching: number;
  roomsOpen: number;
  matchesRunning: number;
  replays: number;
  replaysToday: number;
  submissionsWaiting: number;
  bans: number;
  uploadedPictures: number;
  /** Entries per board: `xp`, `online`, `endless` and today's daily one. */
  entries: Record<string, number>;
  /** Today's counters (`counters/{day}`), verification minutes included. */
  today: Record<string, number>;
}

const count = async (query: Query) => (await query.count().get()).data().count;

/**
 * The overview's statistics (ADR 0012): about fifteen aggregations, so
 * tens of reads. Players online come from the RTDB `connections` node,
 * which every signed-in client writes, with or without `shareStatus`.
 */
export async function computeStats(
  db: Firestore,
  realtime: Realtime,
  now: number
): Promise<AdminStats> {
  const at = (ms: number) => Timestamp.fromMillis(ms);
  const day = dayOf(now);
  const boards = ['xp', 'online', 'endless', dailyBoardId(day)];
  const [
    accounts,
    active24h,
    active7d,
    searching,
    rooms,
    matchesRunning,
    replays,
    replaysToday,
    submissionsWaiting,
    bans,
    uploadedPictures,
    counter,
    connections,
    ...entryCounts
  ] = await Promise.all([
    db.doc(ACCOUNTS_DOC).get(),
    count(
      db.collection('boardMembers').where('activeAt', '>=', at(now - DAY_MS))
    ),
    count(
      db
        .collection('boardMembers')
        .where('activeAt', '>=', at(now - 7 * DAY_MS))
    ),
    count(db.collection('queue').where('seen', '>=', at(now - QUEUE_SEEN_MS))),
    count(db.collection('rooms').where('expireAt', '>', at(now))),
    count(
      db
        .collection('rooms')
        .where('taken', '==', true)
        .where('expireAt', '>', at(now))
    ),
    count(db.collection('replays')),
    count(db.collection('replays').where('createdAt', '>=', at(dayStart(day)))),
    count(db.collection('replaySubmissions')),
    count(db.collection('bans')),
    count(db.collection('profiles').where('avatar.kind', '==', 'image')),
    db.doc(`counters/${day}`).get(),
    realtime.get('connections'),
    ...boards.map((boardId) =>
      count(db.collection(`boards/${boardId}/entries`))
    ),
  ]);
  const online = Object.values(
    (connections ?? {}) as Record<string, { state?: unknown } | null>
  );
  const today: Record<string, number> = {};
  for (const [key, value] of Object.entries(counter.data() ?? {})) {
    if (typeof value === 'number') {
      today[key] = value;
    }
  }
  const total: unknown = accounts.get('total');
  return {
    accounts: typeof total === 'number' ? total : 0,
    active24h,
    active7d,
    online: online.length,
    playing: online.filter((entry) => entry?.state === 'playing').length,
    searching,
    roomsOpen: rooms - matchesRunning,
    matchesRunning,
    replays,
    replaysToday,
    submissionsWaiting,
    bans,
    uploadedPictures,
    entries: Object.fromEntries(boards.map((id, i) => [id, entryCounts[i]])),
    today,
  };
}

/**
 * `stats.refresh`: writes `adminStats/now` - and, from `hourly`, the
 * hour's snapshot `h_{yyyymmddhh}`, kept 90 days.
 */
export async function refreshStats(
  db: Firestore,
  realtime: Realtime,
  now: number,
  { snapshot = false } = {}
): Promise<AdminStats> {
  const stats = await computeStats(db, realtime, now);
  const doc = { ...stats, at: FieldValue.serverTimestamp() };
  const hour = new Date(atHourOf(now) * HOUR_MS)
    .toISOString()
    .slice(0, 13)
    .replace(/[-T]/g, '');
  await Promise.all([
    db.doc('adminStats/now').set(doc),
    snapshot
      ? db.doc(`adminStats/h_${hour}`).set({
          ...doc,
          expireAt: Timestamp.fromMillis(now + SNAPSHOT_TTL_MS),
        })
      : null,
  ]);
  return stats;
}

/**
 * `stats.recount`: sets `stats/accounts` to the number of accounts Auth
 * holds (`accountUids` pages through them) - once after launch, since
 * accounts older than `countAccount` were never counted, then when in
 * doubt. Each account it counts is noted as `accountCounted`, like
 * `countAccount` does, so deleting it lowers the total again and a late
 * `countAccount` event does not count it twice. Returns the old and the
 * new total.
 */
export async function recountAccounts(
  db: Firestore,
  accountUids: () => Promise<readonly string[]>
): Promise<{ before: number | null; after: number }> {
  const ref = db.doc(ACCOUNTS_DOC);
  const [stored, uids] = await Promise.all([ref.get(), accountUids()]);
  const writer = db.bulkWriter();
  const marks = uids.map((uid) =>
    writer.set(
      db.doc(`boardMembers/${uid}`),
      { accountCounted: true },
      { merge: true }
    )
  );
  await writer.close();
  await Promise.all(marks);
  await ref.set(
    { total: uids.length, updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );
  const before: unknown = stored.get('total');
  return {
    before: typeof before === 'number' ? before : null,
    after: uids.length,
  };
}
