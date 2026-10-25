import type { Firestore } from 'firebase-admin/firestore';
import { entryData, hiddenByOf, memberEntries } from './entries';
import { type BoardProfile, boardProfileOf } from './names';

/** True when the change touches how a player's entries look. */
export function relabels(before: BoardProfile, after: BoardProfile): boolean {
  return (
    before.name !== after.name ||
    before.publicName !== after.publicName ||
    before.boardOptOut !== after.boardOptOut ||
    before.preset !== after.preset
  );
}

/**
 * Relabels a player's entries on every board they are on
 * (`boardMembers/{uid}.boards`, the all-time boards and up to 31 daily
 * ones) when their name, `publicName`, `boardOptOut` or preset avatar
 * changes (ADR 0012) - so withdrawing the opt-in, opting out or a
 * moderation reset reaches past daily boards too. Banned players included.
 */
export async function boardProfileChanged(
  db: Firestore,
  uid: string,
  beforeData: unknown,
  afterData: unknown
): Promise<number> {
  const after = boardProfileOf(afterData);
  if (!relabels(boardProfileOf(beforeData), after)) {
    return 0;
  }
  const member = await db.doc(`boardMembers/${uid}`).get();
  let relabelled = 0;
  for (const { boardId, entryId } of memberEntries(member.data())) {
    const ref = db.doc(`boards/${boardId}/entries/${entryId}`);
    const done = await db.runTransaction(async (tx) => {
      const entry = await tx.get(ref);
      if (!entry.exists) {
        return false;
      }
      const data = entry.data() ?? {};
      tx.set(ref, {
        ...entryData(
          entryId,
          {
            sort: data['sort'],
            atHour: data['atHour'],
            baseStatus: data['baseStatus'] ?? data['status'],
            show: data['show'],
          },
          after,
          hiddenByOf(data['hiddenBy'])
        ),
        // A daily entry keeps its TTL.
        ...(data['expireAt'] === undefined
          ? {}
          : { expireAt: data['expireAt'] }),
      });
      return true;
    });
    relabelled += done ? 1 : 0;
  }
  return relabelled;
}
