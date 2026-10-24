import { FieldValue, Firestore, Timestamp } from 'firebase-admin/firestore';
import { REPLAY_DAYS } from '../config';
import type { Engine } from '../engine';
import { DAY_MS, dayOf } from '../time';
import type { PublicReplayDoc, PublicSeat, ReplayDoc } from './model';
import { publicNameOf } from './public-name';

/** Preset avatars there are - one per colour, as the gallery draws them. */
const PRESET_AVATARS = 12;

/** Why a replay was not published. */
export type NotPublished =
  /** A player took it down, or keeps their matches out of the gallery. */
  | 'opted-out'
  /** Not verified, or no summary to show. */
  | 'not-verified'
  /** An online match whose room did not name both players. */
  | 'unbound'
  | 'no-blob'
  | 'already-public';

/**
 * The uid of each seat: the player and the bot against the computer; the
 * room's host on the left and its guest on the right online (ADR 0012) -
 * null where a room did not name both reporters.
 */
export function seatUids(doc: ReplayDoc): (string | null)[] | null {
  if (doc.kind !== 'online') {
    return [doc.players[0] ?? null, null];
  }
  const host = doc.room?.host ?? null;
  const guest = doc.room?.guest ?? null;
  return host !== null &&
    guest !== null &&
    host !== guest &&
    doc.players.includes(host) &&
    doc.players.includes(guest)
    ? [host, guest]
    : null;
}

/** The preset avatar the gallery draws for a colour. */
export function colorAvatar(engine: Engine, colorId: string): number {
  const index = engine.COLONY_COLORS.findIndex((color) => color.id === colorId);
  return Math.max(0, index) % PRESET_AVATARS;
}

/** A seat as the public replay shows it. */
function publicSeat(
  engine: Engine,
  colorId: string,
  uid: string | null,
  profile: Record<string, unknown> | undefined
): PublicSeat {
  return {
    label: uid === null ? 'computer' : colorId,
    name: uid === null ? null : publicNameOf(engine, profile),
    colorId,
    avatarPreset: colorAvatar(engine, colorId),
  };
}

/**
 * Publishes a verified replay under a fresh random id, never the private
 * one: the header without room, match number and app version, the players
 * by colour and - only where they opted in - by their checked name. The
 * private copy keeps no `expireAt` while it is public.
 */
export async function publishReplay(
  db: Firestore,
  engine: Engine,
  replayId: string,
  featuredBy: PublicReplayDoc['featuredBy'],
  now = Date.now()
): Promise<{ publicId: string } | NotPublished> {
  const replayRef = db.doc(`replays/${replayId}`);
  const doc = (await replayRef.get()).data() as ReplayDoc | undefined;
  if (
    doc === undefined ||
    doc.state !== 'verified' ||
    doc.summary === undefined
  ) {
    return 'not-verified';
  }
  if (doc.optOut.length > 0) {
    return 'opted-out';
  }
  const seats = seatUids(doc);
  if (seats === null || (doc.kind === 'online' && doc.bound !== true)) {
    return 'unbound';
  }
  const uids = seats.filter((uid): uid is string => uid !== null);
  const profiles = await Promise.all(
    uids.map(async (uid) => (await db.doc(`profiles/${uid}`).get()).data())
  );
  if (profiles.some((profile) => profile?.['galleryOptOut'] === true)) {
    return 'opted-out';
  }
  const blob = await db.doc(`replays/${replayId}/blob/data`).get();
  const bytes = blob.get('bytes') as Uint8Array | undefined;
  const replay =
    bytes === undefined
      ? null
      : await engine.replayFromBytes(new Uint8Array(bytes), { stored: true });
  if (replay === null) {
    return 'no-blob';
  }
  const publicBytes = await engine.replayToBytes(replay, { forPublic: true });
  const profileOf = (uid: string | null) =>
    uid === null ? undefined : profiles[uids.indexOf(uid)];
  const publicRef = db.collection('publicReplays').doc();
  const publicDoc: PublicReplayDoc = {
    replayId,
    uids,
    seatUids: seats,
    levelId: doc.levelId,
    kind: doc.kind,
    balanceVersion: doc.balanceVersion,
    players: seats.map((uid, seat) =>
      publicSeat(engine, replay.header.colors[seat], uid, profileOf(uid))
    ),
    ticks: doc.ticks,
    endedBy: doc.endedBy,
    winnerSeat: doc.winnerSeat,
    score: doc.score ?? 0,
    reasons: doc.reasons ?? [],
    summary: doc.summary,
    featuredAt: Timestamp.fromMillis(now),
    featuredBy,
    day: dayOf(doc.createdAt.toMillis()),
    removedAt: null,
  };
  return db.runTransaction(async (tx) => {
    const current = await tx.get(replayRef);
    if (typeof current.get('publicId') === 'string') {
      return 'already-public';
    }
    if ((current.get('optOut') as string[] | undefined)?.length) {
      return 'opted-out';
    }
    tx.create(publicRef, publicDoc);
    tx.create(publicRef.collection('blob').doc('data'), {
      bytes: Buffer.from(publicBytes),
      size: publicBytes.length,
    });
    tx.update(replayRef, {
      publicId: publicRef.id,
      expireAt: FieldValue.delete(),
    });
    return { publicId: publicRef.id };
  });
}

/**
 * Takes a replay's public copies down: `removedAt` set - a removed one
 * answers 410 and leaves the sitemap - and its blob deleted. The private
 * copy expires again like any other.
 */
export async function takeDown(
  db: Firestore,
  replayId: string,
  now = Date.now()
): Promise<string[]> {
  const published = await db
    .collection('publicReplays')
    .where('replayId', '==', replayId)
    .where('removedAt', '==', null)
    .get();
  const batch = db.batch();
  for (const doc of published.docs) {
    batch.update(doc.ref, { removedAt: Timestamp.fromMillis(now) });
    batch.delete(doc.ref.collection('blob').doc('data'));
  }
  const replayRef = db.doc(`replays/${replayId}`);
  const replay = await replayRef.get();
  if (replay.exists && typeof replay.get('publicId') === 'string') {
    const createdAt = (replay.get('createdAt') as Timestamp).toMillis();
    const expireAt = Math.max(createdAt + REPLAY_DAYS * DAY_MS, now + DAY_MS);
    batch.update(replayRef, {
      publicId: FieldValue.delete(),
      expireAt: Timestamp.fromMillis(expireAt),
    });
  }
  await batch.commit();
  return published.docs.map((doc) => doc.id);
}
