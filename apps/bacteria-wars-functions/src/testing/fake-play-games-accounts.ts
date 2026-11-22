import type {
  PlayGamesAccount,
  PlayGamesAccounts,
} from '../play-games/sign-in';

/**
 * Auth as the Play Games sign-in and adoption see it, for their emulator
 * specs: accounts of each kind, and a fake that logs what was written and
 * minted.
 */

export const guest = (): PlayGamesAccount => ({
  hasProvider: false,
  displayName: null,
  claims: {},
});
export const google = (): PlayGamesAccount => ({
  hasProvider: true,
  displayName: 'Ada',
  claims: { admin: true },
});
export const linkedPlayer = (): PlayGamesAccount => ({
  hasProvider: false,
  displayName: 'PlayAda',
  claims: { playGames: true },
});

/** Auth with the given accounts; logs what was written and minted. */
export function fakeAccounts(known: Record<string, PlayGamesAccount>) {
  const updates: [string, Record<string, unknown>, string | undefined][] = [];
  const tokens: string[] = [];
  const accounts: PlayGamesAccounts = {
    account: async (uid) => known[uid] ?? null,
    update: async (uid, claims, displayName) => {
      updates.push([uid, claims, displayName]);
      const account = known[uid];
      if (account !== undefined) {
        known[uid] = {
          ...account,
          claims,
          displayName: displayName ?? account.displayName,
        };
      }
    },
    customToken: async (uid) => {
      tokens.push(uid);
      return `token-for-${uid}`;
    },
  };
  return { accounts, updates, tokens };
}
