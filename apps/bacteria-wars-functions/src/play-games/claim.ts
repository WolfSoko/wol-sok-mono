import { PLAY_GAMES_CLAIM } from '@wolsok/feat-shared-bacteria-engine/cloud';
import type { PlayGamesAccounts } from './sign-in';

/**
 * Sets (`linked`) or drops the `playGames` claim of `uid`, and gives a
 * nameless account `name` where one is given. The claims are read afresh
 * right before the write, so a claim granted meanwhile survives. False when
 * the account is gone.
 */
export async function updatePlayGamesClaim(
  accounts: PlayGamesAccounts,
  uid: string,
  linked: boolean,
  name: string | null = null
): Promise<boolean> {
  const account = await accounts.account(uid);
  if (account === null) {
    return false;
  }
  const { [PLAY_GAMES_CLAIM]: _dropped, ...others } = account.claims;
  await accounts.update(
    uid,
    linked ? { ...others, [PLAY_GAMES_CLAIM]: true } : others,
    account.displayName === null && name !== null ? name : undefined
  );
  return true;
}
