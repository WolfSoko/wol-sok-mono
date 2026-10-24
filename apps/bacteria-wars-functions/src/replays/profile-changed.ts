import { Firestore } from 'firebase-admin/firestore';
import { loadEngine } from '../engine';
import type { PublicSeat } from './model';
import { publicNameOf } from './public-name';
import { takeDown } from './publish';

type Profile = Record<string, unknown> | undefined;

/** True when a profile change touches what the gallery shows of the player. */
export function touchesGallery(before: Profile, after: Profile): boolean {
  return (
    before?.['name'] !== after?.['name'] ||
    before?.['publicName'] !== after?.['publicName'] ||
    before?.['galleryOptOut'] !== after?.['galleryOptOut']
  );
}

/**
 * `profileChanged` (ADR 0011): when a player renames, or turns
 * `publicName` off or on, their name is snapshotted again in every public
 * replay they play in - or removed, falling back to the colour label; one
 * the owner anonymised keeps no name. Turning
 * `galleryOptOut` on takes their public replays down. Never checks a ban: an
 * owner's reset of a banned player's profile must reach the gallery too.
 */
export async function onProfileChanged(
  db: Firestore,
  uid: string,
  before: Profile,
  after: Profile,
  now = Date.now()
): Promise<number> {
  if (!touchesGallery(before, after)) {
    return 0;
  }
  const published = await db
    .collection('publicReplays')
    .where('uids', 'array-contains', uid)
    .where('removedAt', '==', null)
    .get();
  if (published.empty) {
    return 0;
  }
  if (after?.['galleryOptOut'] === true) {
    const replayIds = new Set(
      published.docs.map((doc) => doc.get('replayId') as string)
    );
    for (const replayId of replayIds) {
      await takeDown(db, replayId, now);
    }
    return replayIds.size;
  }
  const engine = await loadEngine();
  const name = publicNameOf(engine, after);
  const batch = db.batch();
  for (const doc of published.docs) {
    if (doc.get('anonymised') === true) {
      continue;
    }
    const seats = doc.get('seatUids') as (string | null)[];
    const players = (doc.get('players') as PublicSeat[]).map((player, seat) =>
      seats[seat] === uid ? { ...player, name } : player
    );
    batch.update(doc.ref, { players });
  }
  await batch.commit();
  return published.size;
}
