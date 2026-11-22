import {
  type CommandResult,
  PLAY_GAMES_CLAIM,
  PLAY_GAMES_LINKS,
  type PlayGamesSignInError,
} from '@wolsok/feat-shared-bacteria-engine/cloud';
import { type Firestore, Timestamp } from 'firebase-admin/firestore';
import { updatePlayGamesClaim } from './claim';
import { type LinkAccount, settleLink } from './link';
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
  player: (code: string) => Promise<PlayGamesPlayer | null>;
  /**
   * Applies the ban tombstone of a Play Games player to `uid`: true (and
   * `uid` banned) when a banned account linked to the player was deleted
   * and its ban still holds.
   */
  tombstone: (playerId: string, uid: string) => Promise<boolean>;
  accounts: PlayGamesAccounts;
  now: number;
}

/** The sign-in's answer: the result, and a token where the game needs one. */
export interface PlayGamesSignInAnswer {
  result: CommandResult & { error?: PlayGamesSignInError };
  /** A custom token, and the uid it signs in to. */
  token: { value: string; uid: string } | null;
}

/**
 * Signs `writerUid`'s Play Games player in (#3175 step 2): exchanges the
 * code, settles `playGamesLinks/{playerId}` in a transaction
 * ({@link settleLink}), marks the account it settled on (the claim
 * `playGames`, and the Play Games name where it has none) and answers a
 * custom token for exactly that account - only where the game's session
 * needs one: for a writer without a provider (a guest's session becomes a
 * signed-in one) or a take-over. A Google session keeps its own token, so
 * its sign-in provider (which the owner's rights hang on) stays Google.
 * A link to an account that is gone counts as none. Bans stay with their
 * uid, and a Play Games player's ban tombstone (left by a deleted banned
 * account) bans the writer and links nothing.
 */
export async function signInPlayGames(
  db: Firestore,
  writerUid: string,
  code: string,
  { player: playerOf, tombstone, accounts, now }: PlayGamesSignInDeps
): Promise<PlayGamesSignInAnswer> {
  const [player, writerAccount] = await Promise.all([
    playerOf(code),
    accounts.account(writerUid),
  ]);
  if (player === null) {
    return refused('play-games-refused');
  }
  if (writerAccount === null) {
    return refused('no-account');
  }
  // A banned player who deleted the account takes the ban to the next one,
  // which gets no link: the ban, not the player, is what follows.
  if (await tombstone(player.playerId, writerUid)) {
    return refused('banned');
  }
  const writer = { uid: writerUid, hasProvider: writerAccount.hasProvider };
  const known = new Map([[writerUid, writerAccount]]);
  const ref = db.collection(PLAY_GAMES_LINKS).doc(player.playerId);
  const outcome = await db.runTransaction(async (tx) => {
    const linkedUid: unknown = (await tx.get(ref)).get('uid');
    const linked =
      typeof linkedUid !== 'string'
        ? null
        : linkedUid === writerUid
          ? writer
          : await linkAccountOf(accounts, linkedUid, known);
    const settled = settleLink({ writer, linked });
    if (settled.kind === 'link') {
      tx.set(ref, { uid: settled.uid, linkedAt: Timestamp.fromMillis(now) });
    }
    return settled;
  });
  if (outcome.kind === 'refuse') {
    return refused('linked-elsewhere');
  }
  const settledAccount = known.get(outcome.uid) ?? null;
  if (
    settledAccount === null ||
    !(await markLinked(
      accounts,
      outcome.uid,
      settledAccount,
      player.displayName
    ))
  ) {
    return refused('no-account');
  }
  // The server cannot tell an anonymous session from a custom-token one,
  // so every account without a provider gets a token; the game keeps a
  // session that is signed in already.
  const needsToken = !writer.hasProvider || outcome.kind === 'take-over';
  return {
    result: { ok: true },
    token: needsToken
      ? { value: await accounts.customToken(outcome.uid), uid: outcome.uid }
      : null,
  };
}

/** The account as the decision sees it, kept in `known` for later. */
async function linkAccountOf(
  accounts: PlayGamesAccounts,
  uid: string,
  known: Map<string, PlayGamesAccount>
): Promise<LinkAccount | null> {
  const account = await accounts.account(uid);
  if (account === null) {
    return null;
  }
  known.set(uid, account);
  return { uid, hasProvider: account.hasProvider };
}

/**
 * Marks `uid` as linked ({@link updatePlayGamesClaim}) - only where `seen`
 * (read moments ago) needs it, so nothing is written at the usual later
 * start. False when the account is gone.
 */
async function markLinked(
  accounts: PlayGamesAccounts,
  uid: string,
  seen: PlayGamesAccount,
  name: string | null
): Promise<boolean> {
  return (
    !needsMark(seen, name) || updatePlayGamesClaim(accounts, uid, true, name)
  );
}

function needsMark(account: PlayGamesAccount, name: string | null): boolean {
  return (
    account.claims[PLAY_GAMES_CLAIM] !== true ||
    (account.displayName === null && name !== null)
  );
}

function refused(error: PlayGamesSignInError): PlayGamesSignInAnswer {
  return { result: { ok: false, error }, token: null };
}
