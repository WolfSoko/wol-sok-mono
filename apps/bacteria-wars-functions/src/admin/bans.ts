import {
  DocumentReference,
  Firestore,
  Query,
  QueryDocumentSnapshot,
  Timestamp,
} from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import type { BanReason } from '@wolsok/feat-lazy-bac-game/engine';
import type { Account, AccountLookup } from '../accounts';
import { refreshEntries } from '../boards/entries';
import type { Engine } from '../engine';
import { forgetBans, isBanned } from '../limits';
import type { Presence } from '../presence';
import { takeDown } from '../replays/publish';
import { countModeration, notify, writeAudit } from './records';
import {
  deleteTombstone,
  findTombstone,
  TombstoneKey,
  writeTombstone,
} from './tombstones';

/**
 * Bans (ADR 0012): stored in `bans/{uid}`, mirrored to the Realtime
 * Database, ended by themselves at `until`. Setting one clears the player
 * out of everything others see; lifting one restores only what the ban hid.
 */

/** What moderation needs besides Firestore. */
export interface Moderation {
  db: Firestore;
  engine: Engine;
  presence: Presence;
  accounts: AccountLookup;
  /** Null when the secret is not there: no tombstones are written or read. */
  tombstones: TombstoneKey | null;
}

/** A ban as stored. */
export interface BanState {
  since: number;
  until: number | null;
  reason: BanReason;
}

/** Documents a ban scan deletes per page. */
const PAGE = 300;

/** The player's ban, also one that has ended but was not cleaned up yet. */
export async function readBan(
  db: Firestore,
  uid: string
): Promise<BanState | null> {
  const doc = await db.doc(`bans/${uid}`).get();
  if (!doc.exists) {
    return null;
  }
  const until = doc.get('until') as Timestamp | null;
  return {
    since: (doc.get('since') as Timestamp).toMillis(),
    until: until === null ? null : until.toMillis(),
    reason: doc.get('reason') as BanReason,
  };
}

/** What a ban did, for the audit. */
export interface BanResult {
  before: BanState | null;
  after: BanState;
  /** True when the player was banned already: only the end and reason changed. */
  changed: boolean;
}

/**
 * Bans a player, or changes the end and reason of a ban that is on. A new
 * ban deletes their queue entry, status, connection, rooms, invites,
 * challenges and friend requests; hides their board entries; takes their
 * public replays down; writes a tombstone for a Google account; and
 * notifies them.
 */
export async function banPlayer(
  moderation: Moderation,
  uid: string,
  until: number | null,
  reason: BanReason,
  now: number
): Promise<BanResult> {
  const { db, presence } = moderation;
  const before = await readBan(db, uid);
  const changed = before !== null && isBanned(before.until, now);
  const after: BanState = {
    since: changed ? before.since : now,
    until,
    reason,
  };
  await db.doc(`bans/${uid}`).set({
    since: Timestamp.fromMillis(after.since),
    until: until === null ? null : Timestamp.fromMillis(until),
    reason,
  });
  await presence.set(`bans/${uid}`, until ?? 0);
  forgetBans();
  const account = (await moderation.accounts([uid])).get(uid);
  if (moderation.tombstones !== null && account?.googleUid) {
    await writeTombstone(
      db,
      moderation.tombstones,
      account.googleUid,
      { until, reason },
      now
    );
  }
  if (changed) {
    return { before, after, changed: true };
  }
  await clearOut(moderation, uid);
  await refreshEntries(db, moderation.engine, uid, now);
  const published = await db
    .collection('publicReplays')
    .where('uids', 'array-contains', uid)
    .where('removedAt', '==', null)
    .get();
  for (const replayId of new Set(
    published.docs.map((doc) => doc.get('replayId') as string)
  )) {
    await takeDown(db, replayId, now);
  }
  await notify(db, uid, 'banned', now, { until, reason });
  await countModeration(db, uid, 'bans');
  return { before, after, changed: false };
}

/**
 * Takes the player out of everything others meet them in: the queue, the
 * status and connection, the rooms they host, their invites, the
 * challenges they sent and the friend requests they left.
 */
async function clearOut(moderation: Moderation, uid: string): Promise<void> {
  const { db, presence } = moderation;
  await db.doc(`queue/${uid}`).delete();
  await presence.remove(`status/${uid}`);
  await presence.remove(`connections/${uid}`);
  await deleteAll(db, db.collection('rooms').where('host', '==', uid));
  await deleteAll(db, db.collection('invites').where('from', '==', uid));
  // Challenges and requests are keyed by their sender's uid, and a
  // collection-group query cannot filter on a document id alone, so they
  // are scanned: challenges expire within the hour, requests are few.
  await deleteSentBy(db, 'challenges', uid);
  await deleteSentBy(db, 'requests', uid);
}

async function deleteAll(db: Firestore, query: Query): Promise<void> {
  for (;;) {
    const page = await query.limit(PAGE).get();
    if (page.empty) {
      return;
    }
    const batch = db.batch();
    page.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    if (page.size < PAGE) {
      return;
    }
  }
}

/**
 * Deletes the documents of a collection group whose id is the sender's
 * uid: streamed with no field read, no filter and no order, which needs no
 * index.
 */
async function deleteSentBy(
  db: Firestore,
  group: string,
  uid: string
): Promise<void> {
  const sent: DocumentReference[] = [];
  for await (const doc of db.collectionGroup(group).select().stream()) {
    const snapshot = doc as unknown as QueryDocumentSnapshot;
    if (snapshot.id === uid) {
      sent.push(snapshot.ref);
    }
  }
  for (let i = 0; i < sent.length; i += PAGE) {
    const batch = db.batch();
    sent.slice(i, i + PAGE).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
}

/**
 * Lifts a ban: deletes both ban documents and the tombstone, restores the
 * entries the ban hid (not those the owner hid or the player opted out
 * of) and notifies the player. Public replays taken down stay down.
 * Returns the ban it lifted, null when there was none.
 */
export async function unbanPlayer(
  moderation: Moderation,
  uid: string,
  now: number
): Promise<BanState | null> {
  const { db, presence } = moderation;
  const before = await readBan(db, uid);
  if (before === null) {
    return null;
  }
  await db.doc(`bans/${uid}`).delete();
  await presence.remove(`bans/${uid}`);
  forgetBans();
  const account = (await moderation.accounts([uid])).get(uid);
  if (moderation.tombstones !== null && account?.googleUid) {
    await deleteTombstone(db, moderation.tombstones, account.googleUid);
  }
  await refreshEntries(db, moderation.engine, uid, now);
  await notify(db, uid, 'unbanned', now);
  return before;
}

/**
 * Re-applies a ban that outlived a deleted Google account to the uid now
 * linked to it (ADR 0012), with a system audit entry. Returns true when it
 * banned the player.
 */
export async function applyTombstone(
  moderation: Moderation,
  account: Account,
  now: number
): Promise<boolean> {
  if (moderation.tombstones === null || !account.googleUid) {
    return false;
  }
  const tombstone = await findTombstone(
    moderation.db,
    moderation.tombstones,
    account.googleUid,
    now
  );
  if (tombstone === null) {
    return false;
  }
  const result = await banPlayer(
    moderation,
    account.uid,
    tombstone.until,
    tombstone.reason,
    now
  );
  await writeAudit(
    moderation.db,
    `tombstone_${account.uid}_${now}`,
    {
      by: 'system',
      type: 'player.ban',
      target: { uid: account.uid },
      reason: 'ban tombstone of the linked Google account',
      before: result.before,
      after: result.after,
      ok: true,
      source: 'system',
    },
    now
  );
  logger.info('Ban re-applied from a tombstone', { uid: account.uid });
  return true;
}

/**
 * The check after a guest linked Google (ADR 0012): once per player, when
 * their account has a Google identity, `boardMembers.googleChecked` is set
 * and the tombstone applied. A guest is looked up again at most every ten
 * minutes per instance.
 */
export async function checkGoogleLink(
  moderation: Moderation,
  uid: string,
  now: number
): Promise<boolean> {
  if (moderation.tombstones === null) {
    return false;
  }
  const lastLook = guestLooks.get(uid);
  if (lastLook !== undefined && now - lastLook < GUEST_LOOK_MS) {
    return false;
  }
  const member = moderation.db.doc(`boardMembers/${uid}`);
  if ((await member.get()).get('googleChecked') === true) {
    return false;
  }
  const account = (await moderation.accounts([uid])).get(uid);
  if (account === undefined || !account.googleUid) {
    guestLooks.set(uid, now);
    return false;
  }
  await member.set({ googleChecked: true }, { merge: true });
  return applyTombstone(moderation, account, now);
}

const GUEST_LOOK_MS = 10 * 60_000;
const guestLooks = new Map<string, number>();

/** Forgets the guests looked up - for tests. */
export function forgetGuestLooks(): void {
  guestLooks.clear();
}
