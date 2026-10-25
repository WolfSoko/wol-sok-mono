import { replayToBytes } from '@wolsok/feat-lazy-bac-game/engine';
import {
  FieldValue,
  type Firestore,
  type QueryDocumentSnapshot,
  Timestamp,
} from 'firebase-admin/firestore';
import { DAY_MS } from '../boards/budgets';
import { storedReplay } from '../boards/declared-match';
import { type BoardProfile, boardProfileOf, entryLabel } from '../boards/names';
import { REPLAY_TTL_MS } from '../config';
import { dayOf, isBanned } from '../limits';
import { type GalleryReplay, humansOf, isOut } from './candidates';

/** A seat as a public replay shows it - never a uid. */
export interface PublicSeat {
  /** `computer`, or the colony's colour id for a human. */
  label: string;
  /** The player's name - only where they made it public and it passed. */
  name: string | null;
  colorId: string;
  /** The preset avatar the gallery draws for the seat. */
  avatarPreset: number;
}

/** Why a replay was not published. */
type NotPublished =
  /** Not verified, nothing to show, or not the gallery's any more. */
  | 'not-verified'
  /** A player took it down, or keeps their matches out of the gallery. */
  | 'opted-out'
  /** A ban holds for one of its players. */
  | 'banned'
  | 'no-blob'
  | 'already-public';

/**
 * Publishes a verified replay (ADR 0011) under a fresh random id, never the
 * private one: `publicReplays/{publicId}` with the players by colour and,
 * only where they opted in, by their checked name (the boards' rules,
 * `entryLabel`), and its bytes without room, match number and app version
 * (`forPublic`). The private replay then keeps no `expireAt` while it is
 * public; {@link takeDownPublic} gives it one back.
 */
export async function publishReplay(
  db: Firestore,
  replayId: string,
  featuredBy: 'auto' | 'admin',
  now: number
): Promise<{ publicId: string } | NotPublished> {
  const replayRef = db.doc(`replays/${replayId}`);
  const snapshot = await replayRef.get();
  const doc = snapshot.data() as GalleryReplay | undefined;
  const humans = doc === undefined ? null : humansOf(doc);
  if (
    doc === undefined ||
    doc.state !== 'verified' ||
    doc.summary === undefined ||
    humans === null
  ) {
    return 'not-verified';
  }
  if (isOut(doc)) {
    return 'opted-out';
  }
  const profiles = (
    await db.getAll(...humans.map((uid) => db.doc(`profiles/${uid}`)))
  ).map((profile) => boardProfileOf(profile.data()));
  if (profiles.some((profile) => profile.galleryOptOut)) {
    return 'opted-out';
  }
  const banned = await Promise.all(humans.map((uid) => isBanned(db, uid, now)));
  if (banned.includes(true)) {
    return 'banned';
  }
  const replay = await storedReplay(db, replayId);
  if (replay === null) {
    return 'no-blob';
  }
  const bytes = await replayToBytes(replay, { forPublic: true });
  const publicRef = db.collection('publicReplays').doc();
  // Against the computer the right seat is the bot's; online both are human.
  const seatUid = (seat: number) =>
    doc.kind === 'online' ? humans[seat] : seat === 0 ? humans[0] : undefined;
  const players: PublicSeat[] = replay.header.colors.map((colorId, seat) => {
    const uid = seatUid(seat);
    if (uid === undefined) {
      return { label: 'computer', name: null, colorId, avatarPreset: 0 };
    }
    return {
      label: colorId,
      colorId,
      ...seatLabel(publicRef.id, seat, profiles[humans.indexOf(uid)]),
    };
  });
  const createdAt = snapshot.get('createdAt');
  return db.runTransaction(async (tx) => {
    const current = (await tx.get(replayRef)).data() as
      | GalleryReplay
      | undefined;
    if (current?.publicId !== undefined) {
      return 'already-public';
    }
    if (current === undefined || isOut(current)) {
      return 'opted-out';
    }
    tx.create(publicRef, {
      replayId,
      uids: humans,
      // Who played each seat, for anonymising a deleted account's seat.
      seatUids: players.map((_, seat) => seatUid(seat) ?? null),
      levelId: doc.levelId,
      kind: doc.kind,
      balanceVersion: doc.balanceVersion,
      players,
      ticks: doc.ticks,
      endedBy: replay.header.outcome?.endedBy ?? null,
      winnerSeat: doc.winnerSeat,
      score: doc.score ?? 0,
      reasons: doc.reasons ?? [],
      summary: doc.summary,
      featuredAt: Timestamp.fromMillis(now),
      featuredBy,
      day: dayOf(createdAt instanceof Timestamp ? createdAt.toMillis() : now),
      removedAt: null,
    });
    tx.create(publicRef.collection('blob').doc('data'), {
      bytes: Buffer.from(bytes),
      size: bytes.length,
    });
    tx.update(replayRef, {
      publicId: publicRef.id,
      expireAt: FieldValue.delete(),
    });
    return { publicId: publicRef.id };
  });
}

/**
 * Takes a public replay down (`remove`, a ban): `removedAt` set - a removed
 * one answers 410 and leaves the sitemap - and its bytes deleted; the
 * private replay expires again like any other, at the earliest a day from
 * now.
 */
export async function takeDownPublic(
  db: Firestore,
  published: QueryDocumentSnapshot,
  now: number
): Promise<void> {
  const replayId = published.get('replayId');
  const replayRef =
    typeof replayId === 'string' ? db.doc(`replays/${replayId}`) : null;
  const replay = replayRef === null ? null : await replayRef.get();
  const batch = db.batch();
  batch.update(published.ref, { removedAt: Timestamp.fromMillis(now) });
  batch.delete(published.ref.collection('blob').doc('data'));
  if (replay?.exists === true && replay.get('publicId') === published.id) {
    const createdAt = replay.get('createdAt');
    const born = createdAt instanceof Timestamp ? createdAt.toMillis() : now;
    batch.update(replay.ref, {
      publicId: FieldValue.delete(),
      expireAt: Timestamp.fromMillis(
        Math.max(born + REPLAY_TTL_MS, now + DAY_MS)
      ),
    });
  }
  await batch.commit();
}

/**
 * Takes a player's replay out of the gallery for good (`remove`, a ban -
 * ADR 0011): the stored replay keeps the player in `optOut` with
 * `galleryOut`, so nothing features it again, and then its public copies
 * come down ({@link takeDownPublic}) - in that order, as a public copy
 * marked removed is skipped next time.
 */
export async function removeFromGallery(
  db: Firestore,
  replayId: string,
  uid: string,
  now: number
): Promise<void> {
  const replayRef = db.doc(`replays/${replayId}`);
  if ((await replayRef.get()).exists) {
    await replayRef.update({
      optOut: FieldValue.arrayUnion(uid),
      galleryOut: true,
    });
  }
  const published = await db
    .collection('publicReplays')
    .where('replayId', '==', replayId)
    .where('removedAt', '==', null)
    .get();
  await Promise.all(published.docs.map((doc) => takeDownPublic(db, doc, now)));
}

/** A human seat's name and preset, by the boards' rules (`entryLabel`). */
function seatLabel(
  publicId: string,
  seat: number,
  profile: BoardProfile
): Pick<PublicSeat, 'name' | 'avatarPreset'> {
  const label = entryLabel(`${publicId}_${seat}`, profile, 'verified');
  return { name: label.name, avatarPreset: label.avatar };
}

/**
 * Rewrites the player's seats in their public replays still up, each in
 * a transaction: `rewrite` gets the seat and its index and returns the
 * new one; `extra` adds fields to each update. The number rewritten.
 */
async function rewriteSeats(
  db: Firestore,
  uid: string,
  rewrite: (seat: PublicSeat, index: number, publicId: string) => PublicSeat,
  extra: (seats: (string | null)[]) => Record<string, unknown> = () => ({})
): Promise<number> {
  const published = await db
    .collection('publicReplays')
    .where('uids', 'array-contains', uid)
    .get();
  await Promise.all(
    published.docs.map((doc) =>
      db.runTransaction(async (tx) => {
        const current = (await tx.get(doc.ref)).data() ?? {};
        const seats =
          (current['seatUids'] as (string | null)[] | undefined) ?? [];
        const players = (current['players'] as PublicSeat[] | undefined) ?? [];
        tx.update(doc.ref, {
          ...extra(seats),
          players: players.map((player, index) =>
            seats[index] === uid ? rewrite(player, index, doc.id) : player
          ),
        });
      })
    )
  );
  return published.size;
}

/**
 * Takes a deleted account out of its public replays (ADR 0011): its uid
 * goes, and its seat shows the colour label instead of a name.
 */
export function anonymisePublic(db: Firestore, uid: string): Promise<number> {
  return rewriteSeats(
    db,
    uid,
    (player) => ({ ...player, name: null }),
    (seats) => ({
      uids: FieldValue.arrayRemove(uid),
      seatUids: seats.map((seat) => (seat === uid ? null : seat)),
    })
  );
}

/**
 * Carries a profile change to the player's public replays (ADR 0011): a
 * new name, `publicName` turned off or another preset relabels their
 * seats with the boards' rules; `galleryOptOut` turned on takes them all
 * down (`removeFromGallery`). Called by the profile trigger.
 */
export async function publicProfileChanged(
  db: Firestore,
  uid: string,
  beforeData: unknown,
  afterData: unknown,
  now: number
): Promise<number> {
  const before = boardProfileOf(beforeData);
  const after = boardProfileOf(afterData);
  if (after.galleryOptOut && !before.galleryOptOut) {
    const published = (
      await db
        .collection('publicReplays')
        .where('uids', 'array-contains', uid)
        .get()
    ).docs.filter((doc) => doc.get('removedAt') === null);
    await Promise.all(
      published.map((doc) => {
        const replayId = doc.get('replayId');
        return typeof replayId === 'string'
          ? removeFromGallery(db, replayId, uid, now)
          : takeDownPublic(db, doc, now);
      })
    );
    return published.length;
  }
  const relabels =
    before.name !== after.name ||
    before.publicName !== after.publicName ||
    before.preset !== after.preset;
  return relabels
    ? rewriteSeats(db, uid, (player, index, publicId) => ({
        ...player,
        ...seatLabel(publicId, index, after),
      }))
    : 0;
}
