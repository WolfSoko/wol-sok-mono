import type { Auth, UserRecord } from 'firebase-admin/auth';
import {
  AdminApiError,
  countUsers,
  listGoogleUsers,
  requireAdmin,
  setAdmin,
} from './admin-users';

function userRecord(
  uid: string,
  { google = true, claims = {} as Record<string, unknown> } = {}
): UserRecord {
  return {
    uid,
    displayName: `${uid} name`,
    email: google ? `${uid}@example.com` : undefined,
    photoURL: undefined,
    customClaims: claims,
    providerData: google ? [{ providerId: 'google.com', uid: `g-${uid}` }] : [],
    metadata: {
      creationTime: 'Thu, 15 Oct 2026 10:00:00 GMT',
      lastSignInTime: 'Fri, 16 Oct 2026 10:00:00 GMT',
    },
  } as unknown as UserRecord;
}

/** Firebase Auth with a few users, in pages of `pageSize`. */
function fakeAuth(users: UserRecord[], pageSize = 1000) {
  const byUid = new Map(users.map((user) => [user.uid, user]));
  const auth = {
    verifyIdToken: vi.fn(async (token: string) => {
      if (!token.startsWith('token-')) {
        throw new Error('auth/argument-error');
      }
      return { uid: token.slice('token-'.length) };
    }),
    getUser: vi.fn(async (uid: string) => {
      const user = byUid.get(uid);
      if (!user) {
        throw new Error('auth/user-not-found');
      }
      return user;
    }),
    listUsers: vi.fn(async (_max: number, pageToken?: string) => {
      const start = Number(pageToken ?? 0);
      const end = start + pageSize;
      return {
        users: [...byUid.values()].slice(start, end),
        pageToken: end < byUid.size ? String(end) : undefined,
      };
    }),
    setCustomUserClaims: vi.fn(
      async (uid: string, claims: Record<string, unknown>) => {
        // a copy: the records are shared between tests
        const updated = Object.assign({}, byUid.get(uid), {
          customClaims: claims,
        });
        byUid.set(uid, updated as UserRecord);
      }
    ),
  };
  return auth as typeof auth & Auth;
}

describe('admin users', () => {
  const boss = userRecord('boss', { claims: { admin: true } });
  const ada = userRecord('ada');
  const anon = userRecord('anon', { google: false });

  describe('requireAdmin', () => {
    it('lets an admin through with their uid', async () => {
      await expect(
        requireAdmin(fakeAuth([boss]), 'Bearer token-boss')
      ).resolves.toBe('boss');
    });

    it.each([
      [undefined, 401],
      ['Basic abc', 401],
      ['Bearer forged', 401],
      ['Bearer token-ada', 403],
    ])('refuses %s with %s', async (header, status) => {
      await expect(
        requireAdmin(fakeAuth([boss, ada]), header)
      ).rejects.toMatchObject({ status });
    });

    it('goes by the user record, so a revoked admin is refused at once', async () => {
      const auth = fakeAuth([userRecord('was-admin')]);

      await expect(
        requireAdmin(auth, 'Bearer token-was-admin')
      ).rejects.toBeInstanceOf(AdminApiError);
    });

    it('refuses an admin claim on an account without Google', async () => {
      const auth = fakeAuth([
        userRecord('odd', { google: false, claims: { admin: true } }),
      ]);

      await expect(
        requireAdmin(auth, 'Bearer token-odd')
      ).rejects.toMatchObject({ status: 403 });
    });
  });

  it('lists only Google users and passes the page token on', async () => {
    const page = await listGoogleUsers(fakeAuth([boss, anon, ada], 2), '');

    expect(page.users.map(({ uid }) => uid)).toEqual(['boss']);
    expect(page.users[0]).toMatchObject({
      email: 'boss@example.com',
      isAdmin: true,
      createdAt: '2026-10-15T10:00:00.000Z',
    });
    expect(page.nextPageToken).toBe('2');
  });

  it('counts users across all pages', async () => {
    await expect(countUsers(fakeAuth([boss, anon, ada], 1))).resolves.toEqual({
      users: 2,
      anonymous: 1,
      admins: 1,
    });
  });

  describe('setAdmin', () => {
    it('grants the claim and keeps other claims', async () => {
      const auth = fakeAuth([boss, userRecord('ada', { claims: { beta: 1 } })]);

      const updated = await setAdmin(auth, 'boss', 'ada', true);

      expect(auth.setCustomUserClaims).toHaveBeenCalledWith('ada', {
        beta: 1,
        admin: true,
      });
      expect(updated.isAdmin).toBe(true);
    });

    it('revokes the claim of another admin', async () => {
      const auth = fakeAuth([
        boss,
        userRecord('ada', { claims: { admin: true } }),
      ]);

      await expect(setAdmin(auth, 'boss', 'ada', false)).resolves.toMatchObject(
        { isAdmin: false }
      );
    });

    it.each([
      ['their own rights', 'boss', false, 400],
      ['an anonymous user', 'anon', true, 400],
      ['an unknown user', 'nobody', true, 404],
      ['a malformed request', 42, true, 400],
    ])('refuses %s', async (_case, uid, admin, status) => {
      const auth = fakeAuth([boss, anon]);

      await expect(setAdmin(auth, 'boss', uid, admin)).rejects.toMatchObject({
        status,
      });
      expect(auth.setCustomUserClaims).not.toHaveBeenCalled();
    });
  });
});
