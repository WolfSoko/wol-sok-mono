import type { EntryStatus } from '@wolsok/feat-lazy-bac-game/engine';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { type HiddenBy, hiddenByOf, memberEntries } from '../boards/entries';

/** Why an entry is hidden - see `HiddenBy`. */
export type HideReason = keyof HiddenBy;

/** What a hide changed on one entry, for the audit. */
export interface HideChange {
  boardId: string;
  entryId: string;
  before: EntryStatus;
  after: EntryStatus;
}

/**
 * Hides or shows a player's entries on `boardIds` (every board they are on
 * when omitted) for one `reason` (ADR 0012). An entry stays hidden while
 * any reason holds and comes back with its `baseStatus` once none does;
 * the ranking functions keep `hiddenBy` when they rewrite it. `bar` also
 * records the boards' kinds in `boardMembers.barred`, which a restore
 * clears.
 */
export async function setHidden(
  db: Firestore,
  uid: string,
  reason: HideReason,
  hide: boolean,
  {
    boardIds,
    bar = false,
  }: { boardIds?: readonly string[]; bar?: boolean } = {}
): Promise<HideChange[]> {
  const memberRef = db.doc(`boardMembers/${uid}`);
  return db.runTransaction(async (tx) => {
    const member = (await tx.get(memberRef)).data() ?? {};
    const targets = memberEntries(member, boardIds);
    const refs = targets.map(({ boardId, entryId }) =>
      db.doc(`boards/${boardId}/entries/${entryId}`)
    );
    const entries = refs.length > 0 ? await tx.getAll(...refs) : [];
    const changes: HideChange[] = [];
    entries.forEach((entry, i) => {
      if (!entry.exists) {
        return;
      }
      const hiddenBy = hiddenByOf(entry.get('hiddenBy'));
      if (hide) {
        hiddenBy[reason] = true;
      } else {
        delete hiddenBy[reason];
      }
      const before = entry.get('status') as EntryStatus;
      const after: EntryStatus =
        Object.keys(hiddenBy).length > 0
          ? 'hidden'
          : ((entry.get('baseStatus') as EntryStatus | undefined) ?? before);
      tx.update(entry.ref, {
        hiddenBy,
        status: after,
        updatedAt: FieldValue.serverTimestamp(),
      });
      changes.push({
        boardId: targets[i].boardId,
        entryId: targets[i].entryId,
        before,
        after,
      });
    });
    const kinds = [...new Set(targets.map((target) => target.kind))];
    // A bar is the owner's: a ban's restore leaves it alone.
    if (kinds.length > 0 && reason === 'admin' && (bar || !hide)) {
      tx.set(
        memberRef,
        {
          barred:
            hide && bar
              ? FieldValue.arrayUnion(...kinds)
              : FieldValue.arrayRemove(...kinds),
        },
        { merge: true }
      );
    }
    return changes;
  });
}
