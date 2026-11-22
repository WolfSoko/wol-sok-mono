import {
  type CommandResult,
  PLAY_GAMES_CLAIM,
  PLAY_GAMES_LINKS,
  type PlayGamesSignInError,
} from '@wolsok/feat-shared-bacteria-engine/cloud';
import { type Firestore, Timestamp } from 'firebase-admin/firestore';
import { settleLink } from './link';
import type { PlayGamesPlayer } from './player';

/** An account as the sign-in reads it from Auth. */
export interface PlayGamesAccount {
  /** True when it has a sign-in provider of its own (Google). */
  hasProvider: boolean;
  displayName: string | null;
  claims: Record<string, unknown>;
}

/** What the sign-in needs of Auth. */
export interface PlayGamesAccounts {
  /** The account, null when it is gone. */
  account(uid: string): Promise<PlayGamesAccount | null>;
  /** Writes the claims, and the name where one is given. */
  update(
    uid: string,
    claims: Record<string, unknown>,
    displayName?: string
  ): Promise<void>;
  /** A custom token for the account, valid an hour. */
  customToken(uid: string): Promise<string>;
}

export interface PlayGamesSignInDeps {
  /** The player behind the code, null when Google refuses it. */
  player(code: string): Promise<PlayGamesPlayer | null>;
  accounts: PlayGamesAccounts;
  now: number;
}

/** The sign-in's answer: the result, and the token for a settled account. */
export interface PlayGamesSignInAnswer {
  result: CommandResult & { error?: PlayGamesSignInError | 'no-account' };
  token: string | null;
}

/**
 * Signs `writerUid`'s Play Games player in (#3175 step 2): exchanges the
 * code, settles `playGamesLinks/{playerId}` in a transaction
 * ({@link settleLink}), marks the account it settled on (the claim
 * `playGames`, and the Play Games name where it has none) and answers a
 * custom token for exactly that account. A link to an account that is
 * gone counts as none. Bans stay with their uid: nothing here touches one.
 */
export async function signInPlayGames(
  db: Firestore,
  writerUid: string,
  code: string,
  { player: playerOf, accounts, now }: PlayGamesSignInDeps
): Promise<PlayGamesSignInAnswer> {
  const player = await playerOf(code);
  if (player === null) {
    return refused('play-games-refused');
  }
  const writer = await accounts.account(writerUid);
  if (writer === null) {
    return refused('no-account');
  }
  const ref = db.collection(PLAY_GAMES_LINKS).doc(player.playerId);
  const outcome = await db.runTransaction(async (tx) => {
    const linked: unknown = (await tx.get(ref)).get('uid');
    const linkedUid =
      typeof linked === 'string' &&
      (linked === writerUid || (await accounts.account(linked)) !== null)
        ? linked
        : null;
    const settled = settleLink({
      writer: { uid: writerUid, hasProvider: writer.hasProvider },
      linkedUid,
    });
    if (settled.kind === 'link') {
      tx.set(ref, { uid: settled.uid, linkedAt: Timestamp.fromMillis(now) });
    }
    return settled;
  });
  if (outcome.kind === 'refuse') {
    return refused('linked-elsewhere');
  }
  const account =
    outcome.uid === writerUid ? writer : await accounts.account(outcome.uid);
  if (account === null) {
    return refused('no-account');
  }
  await accounts.update(
    outcome.uid,
    { ...account.claims, [PLAY_GAMES_CLAIM]: true },
    account.displayName === null ? (player.displayName ?? undefined) : undefined
  );
  return {
    result: { ok: true },
    token: await accounts.customToken(outcome.uid),
  };
}

function refused(
  error: PlayGamesSignInError | 'no-account'
): PlayGamesSignInAnswer {
  return { result: { ok: false, error }, token: null };
}
