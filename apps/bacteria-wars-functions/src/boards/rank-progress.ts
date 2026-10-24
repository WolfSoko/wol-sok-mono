import { Timestamp } from 'firebase-admin/firestore';
import { checkGoogleLink, Moderation } from '../admin/bans';
import { assertActive, Banned } from '../limits';
import {
  entryRef,
  memberOf,
  memberRef,
  putEntry,
  readStanding,
} from './entries';

/** What `rankProgress` did. */
export type RankProgressResult =
  | { counted: number; claimed: number }
  | { skipped: 'deleted' | 'banned' | 'unparsable' | 'barred' };

/**
 * `rankProgress` (ADR 0012): a write of the player's progress feeds the
 * rank board. The server computes the XP from the stored progress with the
 * game's own `parseProgress` and `xpOf`, and the ledger (`countXp`) lets
 * the board XP rise no faster than a human could earn it. Also notes
 * `activeAt` for the statistics, and checks a ban tombstone once after a
 * guest linked Google.
 *
 * `createdAt` is the progress document's server `createTime`, which a
 * client cannot forge: only progress from before `XP_FULL_COUNT_BEFORE`
 * counts up to 25,000 at once.
 */
export async function rankProgress(
  moderation: Moderation,
  uid: string,
  stored: Record<string, unknown> | undefined,
  createdAt: number | undefined,
  now = Date.now()
): Promise<RankProgressResult> {
  const { db, engine } = moderation;
  if (stored === undefined) {
    return { skipped: 'deleted' };
  }
  try {
    await assertActive(db, uid, now);
  } catch (error) {
    if (error instanceof Banned) {
      return { skipped: 'banned' };
    }
    throw error;
  }
  if (await checkGoogleLink(moderation, uid, now)) {
    return { skipped: 'banned' };
  }
  let claimed: number;
  try {
    const json = stored['json'];
    if (typeof json !== 'string') {
      return { skipped: 'unparsable' };
    }
    claimed = engine.xpOf(engine.parseProgress(JSON.parse(json)));
  } catch {
    return { skipped: 'unparsable' };
  }
  // The board's score takes whole XP only (`xpSort`).
  if (!Number.isSafeInteger(claimed) || claimed < 0) {
    return { skipped: 'unparsable' };
  }
  return db.runTransaction(async (tx): Promise<RankProgressResult> => {
    const member = memberOf(await tx.get(memberRef(db, uid)));
    const ref = entryRef(db, 'xp', member.entryIds.xp);
    const entry = await tx.get(ref);
    const standing = await readStanding(tx, db, uid, now);
    member.activeAt = Timestamp.fromMillis(now);
    if (member.barred.includes('xp')) {
      tx.set(memberRef(db, uid), member);
      return { skipped: 'barred' };
    }
    const before = member.xp?.counted ?? 0;
    const ledger = engine.countXp(
      member.xp ?? null,
      claimed,
      now,
      createdAt ?? now
    );
    member.xp = ledger;
    if (
      (ledger.counted !== before || !entry.exists) &&
      (ledger.counted > 0 || entry.exists)
    ) {
      putEntry(tx, db, engine, {
        boardId: 'xp',
        member,
        standing,
        score: {
          sort: engine.xpSort(ledger.counted),
          atHour: engine.atHourOf(now),
          baseStatus: 'counted',
          show: {
            xp: ledger.counted,
            rank: engine.rankFor(ledger.counted).rank.id,
          },
        },
        now,
      });
    }
    tx.set(memberRef(db, uid), member);
    return { counted: ledger.counted, claimed };
  });
}
