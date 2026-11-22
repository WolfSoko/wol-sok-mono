import {
  type CommandResult,
  parsePlayGamesSignIn,
  PLAY_GAMES_SIGN_INS,
  PLAY_GAMES_TOKEN_KEY,
  PLAY_GAMES_TOKEN_UID_KEY,
} from '@wolsok/feat-shared-bacteria-engine/cloud';
import type { Firestore } from 'firebase-admin/firestore';
import { claimCommand } from '../commands/claim-command';
import { runCommandDocument } from '../commands/run-command-document';
import type { PlayGamesPlayer } from './player';
import {
  type PlayGamesAccounts,
  type PlayGamesSignInAnswer,
  signInPlayGames,
} from './sign-in';

/** What a Play Games sign-in command needs from outside. */
export interface PlayGamesCommandDeps {
  /** The player behind a code, null when Google refuses it. */
  player: (code: string) => Promise<PlayGamesPlayer | null>;
  /** See `PlayGamesSignInDeps.tombstone`. */
  tombstone: (playerId: string, uid: string) => Promise<boolean>;
  /** Auth, loaded only for a command that runs. */
  accounts: () => Promise<PlayGamesAccounts>;
  now: () => number;
}

/**
 * Runs `playGamesSignIns/{id}` (#3175 step 2) through
 * `runCommandDocument`: once per command (`claimCommand`, since its code is
 * single-use), for its writer, and writes the custom token and the uid it
 * is for beside the result where the sign-in answered one.
 */
export async function runPlayGamesSignIn(
  db: Firestore,
  id: string,
  data: Record<string, unknown>,
  authId: string | undefined,
  deps: PlayGamesCommandDeps
): Promise<CommandResult | null> {
  const path = `${PLAY_GAMES_SIGN_INS}/${id}`;
  let answer: PlayGamesSignInAnswer | null = null;
  return runCommandDocument(
    db,
    path,
    data,
    authId,
    async (uid) => {
      const command = parsePlayGamesSignIn(data);
      if (command === null) {
        return { ok: false, error: 'malformed' };
      }
      if (!(await claimCommand(db, path))) {
        return null;
      }
      answer = await signInPlayGames(db, uid, command.code, {
        player: deps.player,
        tombstone: deps.tombstone,
        accounts: await deps.accounts(),
        now: deps.now(),
      });
      return answer.result;
    },
    () =>
      answer?.token == null
        ? {}
        : {
            [PLAY_GAMES_TOKEN_KEY]: answer.token.value,
            [PLAY_GAMES_TOKEN_UID_KEY]: answer.token.uid,
          }
  );
}
