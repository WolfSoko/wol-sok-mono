import { Firestore, Query, Timestamp } from 'firebase-admin/firestore';
import type { Auth } from 'firebase-admin/auth';
import type { Engine } from '../engine';
import type { Presence } from '../presence';
import { minuteTicks, VERIFY_MINUTES } from '../replays/budgets';
import { DAY_MS, dayOf, dayStart } from '../time';

/**
 * The owner's statistics without expensive scans (ADR 0012): each figure is
 * one counter, one Realtime Database read or one `count()` - one read per
 * 1,000 entries counted.
 */

/** Days an hourly snapshot is kept. */
export const STATS_HOUR_DAYS = 90;

/** `adminStats/now` and its hourly snapshots. */
export interface AdminStats {
  accounts: number;
  active24h: number;
  active7d: number;
  online: number;
  playing: number;
  searching: number;
  rooms: { open: number; matches: number };
  replays: { stored: number; today: number; public: number; uploading: number };
  boards: {
    entries: Record<string, number>;
    beingChecked: Record<string, number>;
    verifyMinutes: Record<string, number>;
    verifyMinutesCap: Record<string, number>;
    failedChecks: number;
  };
  moderation: { bans: number; pictures: number };
  at: Timestamp;
}

async function count(query: Query): Promise<number> {
  return (await query.count().get()).data().count;
}

/** Works out the statistics now. */
export async function computeStats(
  db: Firestore,
  engine: Engine,
  presence: Presence,
  now = Date.now()
): Promise<AdminStats> {
  const at = (ms: number) => Timestamp.fromMillis(ms);
  const today = dayOf(now);
  const members = db.collection('boardMembers');
  const rooms = db.collection('rooms');
  const connections = (await presence.read('connections')) as Record<
    string,
    { state?: unknown }
  > | null;
  const states = Object.values(connections ?? {});
  const dailyId = engine.dailyBoardId(today);
  const boardIds = ['xp', 'online', 'endless', dailyId];
  const entries: Record<string, number> = {};
  const beingChecked: Record<string, number> = {};
  for (const boardId of boardIds) {
    const collection = db.collection(`boards/${boardId}/entries`);
    entries[boardId] = await count(
      collection.where('status', 'in', engine.VISIBLE_STATUSES)
    );
    if (boardId === 'endless' || boardId === dailyId) {
      beingChecked[boardId] = await count(
        collection.where('status', '==', 'provisional')
      );
    }
  }
  const counters = await db.doc(`counters/${today}`).get();
  const minutes = (pool: string) =>
    Math.round(
      ((counters.get(`verifyTicks.${pool}`) as number | undefined) ?? 0) /
        minuteTicks(engine, 1)
    );
  return {
    accounts:
      ((await db.doc('stats/accounts').get()).get('total') as
        | number
        | undefined) ?? 0,
    active24h: await count(members.where('activeAt', '>=', at(now - DAY_MS))),
    active7d: await count(
      members.where('activeAt', '>=', at(now - 7 * DAY_MS))
    ),
    online: states.length,
    playing: states.filter((state) => state?.state === 'playing').length,
    searching: await count(
      db.collection('queue').where('seen', '>=', at(now - 45_000))
    ),
    rooms: await (async () => {
      const all = await count(rooms.where('expireAt', '>', at(now)));
      const matches = await count(
        rooms.where('taken', '==', true).where('expireAt', '>', at(now))
      );
      return { open: Math.max(0, all - matches), matches };
    })(),
    replays: {
      stored: await count(db.collection('replays')),
      today: await count(
        db.collection('replays').where('createdAt', '>=', at(dayStart(today)))
      ),
      public: await count(
        db.collection('publicReplays').where('removedAt', '==', null)
      ),
      uploading: await count(db.collection('replaySubmissions')),
    },
    boards: {
      entries,
      beingChecked,
      verifyMinutes: Object.fromEntries(
        Object.keys(VERIFY_MINUTES).map((pool) => [pool, minutes(pool)])
      ),
      verifyMinutesCap: { ...VERIFY_MINUTES },
      failedChecks: (counters.get('failedChecks') as number | undefined) ?? 0,
    },
    moderation: {
      bans:
        (await count(db.collection('bans').where('until', '==', null))) +
        (await count(db.collection('bans').where('until', '>', at(now)))),
      pictures: await count(
        db.collection('profiles').where('avatar.kind', '==', 'image')
      ),
    },
    at: at(now),
  };
}

/**
 * Writes `adminStats/now` - and, for the hourly function, the snapshot
 * `adminStats/h_{yyyymmddhh}`, kept 90 days.
 */
export async function writeStats(
  db: Firestore,
  engine: Engine,
  presence: Presence,
  now = Date.now(),
  snapshot = false
): Promise<AdminStats> {
  const stats = await computeStats(db, engine, presence, now);
  await db.doc('adminStats/now').set(stats);
  if (snapshot) {
    const hour = new Date(now).toISOString().slice(0, 13).replace(/[-T]/g, '');
    await db.doc(`adminStats/h_${hour}`).set({
      ...stats,
      expireAt: Timestamp.fromMillis(now + STATS_HOUR_DAYS * DAY_MS),
    });
  }
  return stats;
}

/**
 * Counts the accounts exactly, 1,000 at a time (`stats.recount`), and sets
 * `stats/accounts`. Once after launch, then when in doubt.
 */
export async function recountAccounts(
  db: Firestore,
  auth: Pick<Auth, 'listUsers'>,
  now = Date.now()
): Promise<number> {
  let total = 0;
  let pageToken: string | undefined;
  do {
    const page = await auth.listUsers(1000, pageToken);
    total += page.users.length;
    pageToken = page.pageToken;
  } while (pageToken !== undefined);
  await db
    .doc('stats/accounts')
    .set({ total, updatedAt: Timestamp.fromMillis(now) });
  return total;
}
