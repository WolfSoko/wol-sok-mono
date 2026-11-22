import {
  type CommandResult,
  parsePlayGamesAdoption,
  PLAY_GAMES_ADOPTIONS,
} from '@wolsok/feat-shared-bacteria-engine/cloud';
import type { Firestore } from 'firebase-admin/firestore';
import { claimCommand } from '../commands/claim-command';
import { runCommandDocument } from '../commands/run-command-document';
import { adoptPlayGamesAccount } from './adoption';
import type { PlayGamesAccounts } from './sign-in';

/** What a Play Games adoption command needs from outside. */
export interface PlayGamesAdoptionCommandDeps {
  /** Auth, loaded only for a command that runs. */
  accounts: () => Promise<PlayGamesAccounts>;
  now: () => number;
}

/**
 * Runs `playGamesAdoptions/{id}` (#3187) through `runCommandDocument`:
 * once per command (`claimCommand`, since the release it consumes is
 * single-use), for its writer.
 */
export async function runPlayGamesAdoption(
  db: Firestore,
  id: string,
  data: Record<string, unknown>,
  authId: string | undefined,
  deps: PlayGamesAdoptionCommandDeps
): Promise<CommandResult | null> {
  const path = `${PLAY_GAMES_ADOPTIONS}/${id}`;
  return runCommandDocument(db, path, data, authId, async (uid) => {
    const command = parsePlayGamesAdoption(data);
    if (command === null || command.from === uid) {
      return { ok: false, error: 'malformed' };
    }
    if (!(await claimCommand(db, path))) {
      return null;
    }
    return adoptPlayGamesAccount(db, uid, command, {
      accounts: await deps.accounts(),
      now: deps.now(),
    });
  });
}
