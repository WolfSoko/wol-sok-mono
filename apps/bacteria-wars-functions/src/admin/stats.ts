import { atHourOf, dailyBoardId } from '@wolsok/feat-lazy-bac-game/engine';
import {
  FieldValue,
  type Firestore,
  type Query,
  Timestamp,
} from 'firebase-admin/firestore';
import { DAY_MS, HOUR_MS } from '../boards/budgets';
import { dayOf } from '../limits';
import type { AdminDeps } from './deps';

/** How long an hourly snapshot is kept (TTL). */
const SNAPSHOT_TTL_MS = 90 * DAY_MS;
/** A queue entry not seen for this long has left. */
const QUEUE_SEEN_MS = 45_000;

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
  entries: Record<string, number>;
  today: Record<string, number>;
}

const count = async (query: Query) => (await query.count().get()).data().count;

/**
 * Computes the overview's statistics: about fifteen aggregations, so tens
 * of reads. Online players come from the RTDB `status` node, which every
 * client writes while signed in.
 */
export async function computeStats(
  db: Firestore,
  deps: AdminDeps,
  now: number
): Promise<AdminStats> {
  const at = (ms: number) => Timestamp.fromMillis(ms);
  const day = dayOf(now);
  const startOfDay = Date.parse(`${day}T00:00:00Z`);
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
    status,
    ...entryCounts
  ] = await Promise.all([
    db.doc('stats/accounts').get(),
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
    count(db.collection('replays').where('createdAt', '>=', at(startOfDay))),
    count(db.collection('replaySubmissions')),
    count(db.collection('bans')),
    count(db.collection('profiles').where('avatar.kind', '==', 'image')),
    db.doc(`counters/${day}`).get(),
    deps.rtdb.get('status'),
    ...boards.map((boardId) =>
      count(db.collection(`boards/${boardId}/entries`))
    ),
  ]);
  const online = Object.values(
    (status ?? {}) as Record<string, { state?: unknown }>
  );
  const today: Record<string, number> = {};
  for (const [key, value] of Object.entries(counter.data() ?? {})) {
    if (typeof value === 'number') {
      today[key] = value;
    }
  }
  return {
    accounts: Number(accounts.get('total') ?? 0),
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
 * Writes `adminStats/now` - and, from the hourly function, the hour's
 * snapshot `h_{yyyymmddhh}`, kept 90 days.
 */
export async function refreshStats(
  db: Firestore,
  deps: AdminDeps,
  now: number,
  { snapshot = false } = {}
): Promise<AdminStats> {
  const stats = await computeStats(db, deps, now);
  const doc = { ...stats, at: FieldValue.serverTimestamp() };
  // `h_yyyymmddhh`: the hour the snapshot is of.
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
 * `stats.recount`: counts every account, a thousand at a time, and sets
 * `stats/accounts` exactly - once after launch, then when in doubt.
 */
export async function recountAccounts(
  db: Firestore,
  deps: AdminDeps
): Promise<number> {
  let total = 0;
  let token: string | undefined;
  do {
    const page = await deps.listUids(token);
    total += page.uids.length;
    token = page.next;
  } while (token !== undefined);
  await db
    .doc('stats/accounts')
    .set({ total, updatedAt: FieldValue.serverTimestamp() });
  return total;
}
