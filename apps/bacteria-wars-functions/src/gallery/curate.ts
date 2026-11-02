import type { Replay } from '@wolsok/feat-lazy-bac-game/engine';
import type { DocumentSnapshot, Firestore } from 'firebase-admin/firestore';
import type { ModerationChange } from '../admin/moderation';
import { type Verdict, verifyReplay } from '../boards/verify';
import { ADMIN_BUDGET } from '../boards/verify-now';
import { spendBudget } from '../boards/verify-slice';
import { fitsGallery, type GalleryReplay } from './candidates';
import {
  alreadyVerified,
  rerunCandidate,
  storeScore,
  type Verified,
} from './feature-best';
import {
  anonymousSeat,
  publicCopiesOf,
  type PublicSeat,
  publishReplay,
  takeDownPublic,
} from './publish';

/**
 * The owner's curation of the gallery (ADR 0011, changed by ADR 0012):
 * `feature`, `unfeature` and `anonymise`, run by `replayCommand`. Each
 * returns what it changed, for the audit, or why it did nothing.
 */

/**
 * `feature`: publishes a stored replay by hand (`featuredBy: 'admin'`). It
 * must fit the gallery as `featureBest` sees it (`fitsGallery`), but its
 * players need no account age: guests too. One the boards have not
 * verified is re-run first, from the admin budget `board.verify` spends
 * too (`ADMIN_BUDGET`); it is scored like the day's pick, without the
 * best-daily feat.
 */
export async function featureReplay(
  db: Firestore,
  replayId: string,
  now: number,
  clock: () => number = () => performance.now(),
  verify: (replay: Replay) => Verdict = (replay) => verifyReplay(replay, clock)
): Promise<ModerationChange | string> {
  const doc = (await db.doc(`replays/${replayId}`).get()).data() as
    | GalleryReplay
    | undefined;
  if (doc === undefined) {
    return 'not-found';
  }
  if (doc.publicId !== undefined) {
    return 'already-public';
  }
  if (!fitsGallery(doc)) {
    return 'not-eligible';
  }
  const stored = { id: replayId, doc };
  let verified: Verified | string | null = alreadyVerified(stored);
  if (verified === null) {
    const spent = await spendBudget(
      db,
      now,
      ADMIN_BUDGET,
      clock,
      (left, charge) => rerunCandidate(db, stored, left, charge, verify)
    );
    verified = spent?.result ?? 'no-budget';
  }
  if (typeof verified === 'string') {
    return verified;
  }
  // A score `featureBest` stored stays: it may carry the best-daily feat.
  const { score, reasons } =
    doc.score === undefined
      ? (await storeScore(db, verified, false)).doc
      : { score: doc.score, reasons: doc.reasons ?? [] };
  const published = await publishReplay(db, replayId, 'admin', now);
  if (typeof published === 'string') {
    return published;
  }
  return {
    before: { state: doc.state },
    after: { ...published, score, reasons },
  };
}

/**
 * The public copies still up of a replay, by its public id or by the
 * private one - what the owner's Replays view shows, either way.
 */
async function stillPublic(
  db: Firestore,
  id: string
): Promise<DocumentSnapshot[]> {
  const [byPublicId, byReplayId] = await Promise.all([
    db.doc(`publicReplays/${id}`).get(),
    publicCopiesOf(db, id),
  ]);
  return [
    ...(byPublicId.exists && byPublicId.get('removedAt') === null
      ? [byPublicId]
      : []),
    ...byReplayId,
  ];
}

/**
 * `unfeature`: takes a public replay down (`takeDownPublic`): it answers
 * 410 and its private replay expires again. Unlike a player's `remove`, it
 * stays featurable: the owner may change their mind.
 */
export async function unfeatureReplay(
  db: Firestore,
  id: string,
  now: number
): Promise<ModerationChange | string> {
  const published = await stillPublic(db, id);
  if (published.length === 0) {
    return 'not-public';
  }
  await Promise.all(published.map((doc) => takeDownPublic(db, doc, now)));
  return {
    before: { publicIds: published.map((doc) => doc.id) },
    after: { removed: true },
  };
}

/**
 * `anonymise`: shows every human seat of a public replay without a name
 * and with a preset derived from the seat (`anonymousSeat`), for good:
 * `anonymised`, on the public copy and the stored replay, keeps a later
 * profile change or a new public copy from bringing a name back. The uids
 * stay, so an opt-out, a ban or a deleted account still reaches it.
 */
export async function anonymiseReplay(
  db: Firestore,
  id: string
): Promise<ModerationChange | string> {
  const published = await stillPublic(db, id);
  if (published.length === 0) {
    return 'not-public';
  }
  await Promise.all(
    published.map((doc) =>
      db.runTransaction(async (tx) => {
        const current = await tx.get(doc.ref);
        const replayId: unknown = current.get('replayId');
        const replay =
          typeof replayId === 'string'
            ? await tx.get(db.doc(`replays/${replayId}`))
            : null;
        const players =
          (current.get('players') as PublicSeat[] | undefined) ?? [];
        tx.update(doc.ref, {
          anonymised: true,
          players: players.map((player, index) =>
            player.label === 'computer'
              ? player
              : anonymousSeat(doc.id, index, player)
          ),
        });
        if (replay?.exists === true) {
          tx.update(replay.ref, { anonymised: true });
        }
      })
    )
  );
  // The audit keeps no names: it outlives the replay by two years.
  return {
    before: { publicIds: published.map((doc) => doc.id) },
    after: { anonymised: true },
  };
}
