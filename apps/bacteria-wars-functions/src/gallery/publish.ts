import { replayToBytes } from '@wolsok/feat-lazy-bac-game/engine';
import {
  FieldValue,
  type Firestore,
  type QueryDocumentSnapshot,
  Timestamp,
} from 'firebase-admin/firestore';
import { DAY_MS } from '../boards/budgets';
import { storedReplay } from '../boards/declared-match';
import { boardProfileOf, entryLabel } from '../boards/names';
import { REPLAY_TTL_MS } from '../config';
import { dayOf } from '../limits';
import { type GalleryReplay, humansOf } from './candidates';

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
export type NotPublished =
  /** Not verified, nothing to show, or not the gallery's any more. */
  | 'not-verified'
  /** A player took it down, or keeps their matches out of the gallery. */
  | 'opted-out'
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
  if (doc.optOut.length > 0 || doc.galleryOut === true) {
    return 'opted-out';
  }
  const profiles = await Promise.all(
    humans.map(async (uid) => (await db.doc(`profiles/${uid}`).get()).data())
  );
  if (profiles.some((profile) => profile?.['galleryOptOut'] === true)) {
    return 'opted-out';
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
    const label = entryLabel(
      `${publicRef.id}_${seat}`,
      boardProfileOf(profiles[humans.indexOf(uid)]),
      'verified'
    );
    return {
      label: colorId,
      name: label.name,
      colorId,
      avatarPreset: label.avatar,
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
    if ((current?.optOut.length ?? 1) > 0 || current?.galleryOut === true) {
      return 'opted-out';
    }
    tx.create(publicRef, {
      replayId,
      uids: humans,
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
