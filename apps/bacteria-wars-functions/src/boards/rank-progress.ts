import {
  atHourOf,
  parseProgress,
  rankFor,
  xpOf,
  xpSort,
} from '@wolsok/feat-lazy-bac-game/engine';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { isBanned } from '../limits';
import { entryData, hiddenFor, memberIn, profileIn } from './entries';
import { nextXp, parseLedger } from './xp-ledger';

/** The storage key the XP board follows. */
export const PROGRESS_KEY = 'bacteria-game.progress';

/** What became of a progress write - for the log and the specs. */
export type ProgressOutcome =
  | { counted: number; claimed: number }
  | 'banned'
  | 'unreadable';

/**
 * Counts a player's stored progress on the XP board (ADR 0012): the XP the
 * game's own `xpOf` makes of it, under the caps of `nextXp`. Also notes
 * when the player was last active. A banned player is not counted.
 *
 * `progressCreatedAt` is the document's server `createTime`, which no
 * client can forge - it decides whether the first count may be full.
 */
export async function rankProgress(
  db: Firestore,
  uid: string,
  stored: Record<string, unknown>,
  progressCreatedAt: number,
  now: number = Date.now()
): Promise<ProgressOutcome> {
  if (await isBanned(db, uid, now)) {
    return 'banned';
  }
  const claimed = claimedXp(stored['json']);
  if (claimed === null) {
    return 'unreadable';
  }
  return db.runTransaction(async (tx) => {
    const member = await memberIn(tx, db, uid);
    const profile = await profileIn(tx, db, uid);
    const entryRef = db.doc(`boards/xp/entries/${member.entryIds.xp}`);
    const entry = await tx.get(entryRef);
    const ledger = nextXp(
      parseLedger(member.data['xp']),
      claimed,
      now,
      progressCreatedAt
    );
    tx.set(
      db.doc(`boardMembers/${uid}`),
      {
        entryIds: member.entryIds,
        boards: FieldValue.arrayUnion('xp'),
        xp: ledger,
        activeAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    const rose = ledger.counted !== entry.get('sort');
    tx.set(
      entryRef,
      entryData(
        member.entryIds.xp,
        {
          sort: xpSort(ledger.counted),
          // The hour it last changed: ties go to who got there first.
          atHour: rose
            ? atHourOf(now)
            : Number(entry.get('atHour') ?? atHourOf(now)),
          baseStatus: 'counted',
          show: { xp: ledger.counted, rank: rankFor(ledger.counted).rank.id },
        },
        profile,
        hiddenFor(member.data, 'xp', entry.get('hiddenBy'))
      )
    );
    return { counted: ledger.counted, claimed };
  });
}

/** The XP a stored progress value claims - null when it cannot be read. */
function claimedXp(json: unknown): number | null {
  if (typeof json !== 'string') {
    return null;
  }
  try {
    return xpOf(parseProgress(JSON.parse(json)));
  } catch {
    return null;
  }
}
