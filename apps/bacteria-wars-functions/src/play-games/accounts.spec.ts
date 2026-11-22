import type { Auth } from 'firebase-admin/auth';
import { authAccounts } from './accounts';

function fakeAuth(overrides: Partial<Record<keyof Auth, unknown>>): Auth {
  return overrides as unknown as Auth;
}

describe('authAccounts', () => {
  it('reads provider, name and claims of an account', async () => {
    const accounts = authAccounts(
      fakeAuth({
        getUser: async () => ({
          providerData: [{ providerId: 'google.com' }],
          displayName: 'Ada',
          customClaims: { admin: true },
        }),
      })
    );
    expect(await accounts.account('a')).toEqual({
      hasProvider: true,
      displayName: 'Ada',
      claims: { admin: true },
    });
  });

  it('reads a guest without name or claims', async () => {
    const accounts = authAccounts(
      fakeAuth({ getUser: async () => ({ providerData: [] }) })
    );
    expect(await accounts.account('g')).toEqual({
      hasProvider: false,
      displayName: null,
      claims: {},
    });
  });

  it('is null for an account that is gone, and throws on anything else', async () => {
    const gone = authAccounts(
      fakeAuth({
        getUser: async () => {
          throw Object.assign(new Error('gone'), {
            code: 'auth/user-not-found',
          });
        },
      })
    );
    expect(await gone.account('x')).toBeNull();
    const down = authAccounts(
      fakeAuth({
        getUser: async () => {
          throw new Error('unavailable');
        },
      })
    );
    await expect(down.account('x')).rejects.toThrow('unavailable');
  });

  it('writes the claims, and the name only where one is given', async () => {
    const setCustomUserClaims = jest.fn(async () => undefined);
    const updateUser = jest.fn(async () => ({}));
    const accounts = authAccounts(
      fakeAuth({ setCustomUserClaims, updateUser })
    );
    await accounts.update('a', { playGames: true });
    expect(setCustomUserClaims).toHaveBeenCalledWith('a', { playGames: true });
    expect(updateUser).not.toHaveBeenCalled();
    await accounts.update('a', { playGames: true }, 'Ada');
    expect(updateUser).toHaveBeenCalledWith('a', { displayName: 'Ada' });
  });
});
