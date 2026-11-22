import {
  type CommandResult,
  PLAY_GAMES_CLAIM,
  PLAY_GAMES_LINKS,
  type PlayGamesSignInError,
} from '@wolsok/feat-shared-bacteria-engine/cloud';
import { type Firestore, Timestamp } from 'firebase-admin/firestore';
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
  accounts: PlayGamesAccounts;
  now: number;
}

/** The sign-in's answer: the result, and a token where the game needs one. */
export interface PlayGamesSignInAnswer {
  result: CommandResult & { error?: PlayGamesSignInError };
  token: string | null;
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
 * uid: nothing here touches one.
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
  const writer = await linkAccountOf(accounts, writerUid);
  if (writer === null) {
    return refused('no-account');
  }
  const ref = db.collection(PLAY_GAMES_LINKS).doc(player.playerId);
  const outcome = await db.runTransaction(async (tx) => {
    const linkedUid: unknown = (await tx.get(ref)).get('uid');
    const linked =
      typeof linkedUid !== 'string'
        ? null
        : linkedUid === writerUid
          ? writer
          : await linkAccountOf(accounts, linkedUid);
    const settled = settleLink({ writer, linked });
    if (settled.kind === 'link' || settled.kind === 'move') {
      tx.set(ref, { uid: settled.uid, linkedAt: Timestamp.fromMillis(now) });
    }
    return settled;
  });
  if (outcome.kind === 'refuse') {
    return refused('linked-elsewhere');
  }
  if (outcome.kind === 'move') {
    await setClaim(accounts, outcome.from, false);
  }
  if (!(await setClaim(accounts, outcome.uid, true, player.displayName))) {
    return refused('no-account');
  }
  const needsToken = !writer.hasProvider || outcome.uid !== writerUid;
  return {
    result: { ok: true },
    token: needsToken ? await accounts.customToken(outcome.uid) : null,
  };
}

async function linkAccountOf(
  accounts: PlayGamesAccounts,
  uid: string
): Promise<LinkAccount | null> {
  const account = await accounts.account(uid);
  return account === null ? null : { uid, hasProvider: account.hasProvider };
}

/**
 * Sets or clears the `playGames` claim of `uid`, read afresh right before
 * so a claim granted meanwhile survives, and gives a nameless account
 * `name`. Writes nothing when nothing changes; false when it is gone.
 */
async function setClaim(
  accounts: PlayGamesAccounts,
  uid: string,
  linked: boolean,
  name: string | null = null
): Promise<boolean> {
  const account = await accounts.account(uid);
  if (account === null) {
    return false;
  }
  const { [PLAY_GAMES_CLAIM]: had, ...others } = account.claims;
  const displayName =
    account.displayName === null && name !== null ? name : undefined;
  if ((had === true) !== linked || displayName !== undefined) {
    await accounts.update(
      uid,
      linked ? { ...others, [PLAY_GAMES_CLAIM]: true } : others,
      displayName
    );
  }
  return true;
}

function refused(error: PlayGamesSignInError): PlayGamesSignInAnswer {
  return { result: { ok: false, error }, token: null };
}
