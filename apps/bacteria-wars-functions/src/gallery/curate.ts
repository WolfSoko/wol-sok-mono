import type { Replay } from '@wolsok/feat-lazy-bac-game/engine';
import type { DocumentSnapshot, Firestore } from 'firebase-admin/firestore';
import type { ModerationChange } from '../admin/moderation';
import {
  ADMIN_COMMAND_MS,
  ADMIN_VERIFY_MS,
  expectedRerunMs,
} from '../boards/budgets';
import { storedReplay } from '../boards/declared-match';
import { type Verdict, verifyReplay } from '../boards/verify';
import { spendBudget } from '../boards/verify-slice';
import { countRerun } from '../replays/level-stats';
import { fitsGallery, type GalleryReplay } from './candidates';
import {
  applyVerdict,
  asVerified,
  storeScore,
  type Verified,
} from './feature-best';
import { type PublicSeat, publishReplay, takeDownPublic } from './publish';

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
 * too (`adminVerifyMs`); it is scored like the day's pick, without the
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
  const verified =
    doc.state === 'verified' && doc.summary !== undefined
      ? asVerified({ id: replayId, doc }, doc.summary, doc.medal)
      : await rerun(db, replayId, doc, now, clock, verify);
  if (typeof verified === 'string') {
    return verified;
  }
  const { score, reasons } = (await storeScore(db, verified, false)).doc;
  const published = await publishReplay(db, replayId, 'admin', now);
  if (typeof published === 'string') {
    return published;
  }
  return {
    before: { state: doc.state },
    after: { ...published, score, reasons },
  };
}

/** Re-runs a replay to feature it, from the admin budget. */
async function rerun(
  db: Firestore,
  replayId: string,
  doc: GalleryReplay,
  now: number,
  clock: () => number,
  verify: (replay: Replay) => Verdict
): Promise<Verified | string> {
  const spent = await spendBudget(
    db,
    now,
    {
      fields: ['adminVerifyMs'],
      dayMs: ADMIN_VERIFY_MS,
      capMs: ADMIN_COMMAND_MS,
      field: 'adminVerifyMs',
    },
    clock,
    async (left, charge): Promise<Verified | string> => {
      if (expectedRerunMs(doc.ticks) > left()) {
        return 'no-budget';
      }
      const replay = await storedReplay(db, replayId);
      if (replay === null) {
        return 'no-blob';
      }
      const verdict = verify(replay);
      const applied = await applyVerdict(db, replayId, doc.state, verdict);
      await charge();
      if (!applied) {
        return 'changed';
      }
      await countRerun(db, replay.header, doc.kind, verdict);
      return verdict.state === 'verified' && verdict.summary !== undefined
        ? {
            ...asVerified(
              { id: replayId, doc },
              verdict.summary,
              verdict.medal
            ),
            header: replay.header,
          }
        : 'not-verified';
    }
  );
  return spent?.result ?? 'no-budget';
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
    db
      .collection('publicReplays')
      .where('replayId', '==', id)
      .where('removedAt', '==', null)
      .get(),
  ]);
  return [
    ...(byPublicId.exists && byPublicId.get('removedAt') === null
      ? [byPublicId]
      : []),
    ...byReplayId.docs,
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
 * `anonymise`: shows every seat of a public replay by its colour label,
 * for good: `anonymised` keeps a later profile change from bringing a
 * name back. The uids stay, so an opt-out, a ban or a deleted account
 * still reaches it.
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
        const players =
          ((await tx.get(doc.ref)).get('players') as
            | PublicSeat[]
            | undefined) ?? [];
        tx.update(doc.ref, {
          anonymised: true,
          players: players.map((player) => ({ ...player, name: null })),
        });
      })
    )
  );
  // The audit keeps no names: it outlives the replay by two years.
  return {
    before: { publicIds: published.map((doc) => doc.id) },
    after: { anonymised: true },
  };
}
