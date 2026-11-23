import {
  type CommandResult,
  parsePlayGamesSignIn,
  PLAY_GAMES_SIGN_INS,
  PLAY_GAMES_TOKEN_KEY,
  PLAY_GAMES_TOKEN_UID_KEY,
} from '@wolsok/feat-shared-bacteria-engine/cloud';
import type { Firestore } from 'firebase-admin/firestore';
import { logCaughtError, withoutMessage } from '../caught-errors';
import { claimCommand } from '../commands/claim-command';
import { runCommandDocument } from '../commands/run-command-document';
import type { SyncOutcome } from './achievements';
import type { PlayGamesApi } from './games-api';
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
  /** Unlocks `uid`'s earned achievements on Play (step 3). */
  syncAchievements: (uid: string, games: PlayGamesApi) => Promise<SyncOutcome>;
  now: () => number;
}

/**
 * Runs `playGamesSignIns/{id}` (#3175 step 2) through
 * `runCommandDocument`: once per command (`claimCommand`, since its code is
 * single-use), for its writer, and writes the custom token and the uid it
 * is for beside the result where the sign-in answered one. Then, with the
 * result written, it syncs the linked account's achievements to Play:
 * the game never waits for that, and nothing of it fails the sign-in.
 */
export async function runPlayGamesSignIn(
  db: Firestore,
  id: string,
  data: Record<string, unknown>,
  authId: string | undefined,
  deps: PlayGamesCommandDeps
): Promise<CommandResult | null> {
  const path = `${PLAY_GAMES_SIGN_INS}/${id}`;
  // Set inside `run`; a holder, since narrowing cannot follow the callback.
  const signedIn: { answer: PlayGamesSignInAnswer | null } = { answer: null };
  const result = await runCommandDocument(
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
      const answer = await signInPlayGames(db, uid, command.code, {
        player: deps.player,
        tombstone: deps.tombstone,
        accounts: await deps.accounts(),
        now: deps.now(),
      });
      signedIn.answer = answer;
      return answer.result;
    },
    () => {
      const token = signedIn.answer?.token ?? null;
      return token === null
        ? {}
        : {
            [PLAY_GAMES_TOKEN_KEY]: token.value,
            [PLAY_GAMES_TOKEN_UID_KEY]: token.uid,
          };
    }
  );
  const sync = signedIn.answer?.sync ?? null;
  if (sync !== null) {
    await deps.syncAchievements(sync.uid, sync.games).catch((error) => {
      // Its text may quote Google's answer, token and all.
      logCaughtError('Play Games achievement sync failed', {
        error: withoutMessage(error),
      });
    });
  }
  return result;
}
