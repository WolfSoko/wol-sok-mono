import {
  ADOPTION_WINDOW_MS,
  banHolds,
  type CommandResult,
  PLAY_GAMES_LINKS,
  PLAY_GAMES_RELEASES,
  type PlayGamesAdoption,
  type PlayGamesAdoptionError,
} from '@wolsok/feat-shared-bacteria-engine/cloud';
import {
  type Firestore,
  Timestamp,
  type Transaction,
} from 'firebase-admin/firestore';
import { banOf } from '../admin/bans';
import { timestampMillis } from '../timestamps';
import { updatePlayGamesClaim } from './claim';
import type { PlayGamesAccounts } from './sign-in';

export interface PlayGamesAdoptionDeps {
  accounts: PlayGamesAccounts;
  now: number;
}

/** The adoption's answer: why nothing moved, if nothing did. */
export type PlayGamesAdoptionResult = CommandResult & {
  error?: PlayGamesAdoptionError;
};

/**
 * Moves the Play Games links of the Play-only account `from` to the Google
 * account `writerUid` that adopted it (#3187), and the `playGames` claim
 * with them - only when the adoption is proven:
 * - `from` released itself (`playGamesReleases/{from}`) with the same nonce
 *   within `ADOPTION_WINDOW_MS`, so the adoption comes from the tab that
 *   was A a moment ago, not from anyone who knows A's uid;
 * - every storage document of `from` was adopted into the writer's under
 *   the nonce (listed in its `applied`), so `from` loses its claim, and
 *   with it `guestCleanup`'s sparing, only once its progress is in B;
 * - neither account is banned, so a ban never stays behind on an account
 *   `guestCleanup` will delete.
 * One transaction reads all of it, moves the links and consumes the
 * release, so a second adoption with the same nonce moves nothing.
 */
export async function adoptPlayGamesAccount(
  db: Firestore,
  writerUid: string,
  { from, nonce }: PlayGamesAdoption,
  { accounts, now }: PlayGamesAdoptionDeps
): Promise<PlayGamesAdoptionResult> {
  const writer = await accounts.account(writerUid);
  if (writer === null) {
    return refused('no-account');
  }
  if (!writer.hasProvider) {
    return refused('not-google');
  }
  const outcome = await db.runTransaction(async (tx) => {
    // In the transaction: a ban written meanwhile retries it and refuses.
    if (await eitherBanned(db, tx, [writerUid, from], now)) {
      return 'banned';
    }
    if (!(await holdsRelease(db, tx, from, nonce, now))) {
      return 'no-release';
    }
    if (!(await adoptedEverything(db, tx, from, writerUid, nonce))) {
      return 'not-adopted';
    }
    const links = await tx.get(
      db.collection(PLAY_GAMES_LINKS).where('uid', '==', from)
    );
    for (const link of links.docs) {
      tx.set(link.ref, {
        uid: writerUid,
        linkedAt: Timestamp.fromMillis(now),
      });
    }
    tx.delete(db.collection(PLAY_GAMES_RELEASES).doc(from));
    return links.size;
  });
  if (typeof outcome === 'string') {
    return refused(outcome);
  }
  if (outcome > 0) {
    // The writer first: should the second write fail, `from` keeps its
    // claim and only lingers, never losing what it holds.
    await updatePlayGamesClaim(accounts, writerUid, true);
    await updatePlayGamesClaim(accounts, from, false);
  }
  return { ok: true };
}

async function eitherBanned(
  db: Firestore,
  tx: Transaction,
  uids: readonly string[],
  now: number
): Promise<boolean> {
  const bans = await Promise.all(
    uids.map(async (uid) => banOf((await tx.get(db.doc(`bans/${uid}`))).data()))
  );
  return bans.some((ban) => banHolds(ban, now));
}

/** True when `from` released itself with `nonce` within the window. */
async function holdsRelease(
  db: Firestore,
  tx: Transaction,
  from: string,
  nonce: string,
  now: number
): Promise<boolean> {
  const release = await tx.get(db.collection(PLAY_GAMES_RELEASES).doc(from));
  const createdAt = timestampMillis(release.get('createdAt'));
  return (
    release.exists &&
    release.get('uid') === from &&
    release.get('nonce') === nonce &&
    createdAt !== null &&
    now - createdAt <= ADOPTION_WINDOW_MS
  );
}

/**
 * True when every storage document of `from` was adopted into the
 * writer's document of the same key under `nonce`: the player documents
 * list the id of every change made once (`applied`), an empty one too.
 */
async function adoptedEverything(
  db: Firestore,
  tx: Transaction,
  from: string,
  writerUid: string,
  nonce: string
): Promise<boolean> {
  const stored = await tx.get(db.collection(`players/${from}/storage`));
  const adopted = await Promise.all(
    stored.docs.map(async ({ id }) => {
      const applied: unknown = (
        await tx.get(db.doc(`players/${writerUid}/storage/${id}`))
      ).get('applied');
      return Array.isArray(applied) && applied.includes(nonce);
    })
  );
  return adopted.every(Boolean);
}

function refused(error: PlayGamesAdoptionError): PlayGamesAdoptionResult {
  return { ok: false, error };
}
