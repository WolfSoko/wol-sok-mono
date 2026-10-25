import { TestBed } from '@angular/core/testing';
import {
  type FirebaseConnection,
  GameCloud,
} from '@wolsok/feat-lazy-bac-game/admin-kit';
import { AdminAccessService } from './admin-access.service';

const NOW = Date.UTC(2026, 9, 25, 12);

interface FakeUser {
  uid: string;
  isAnonymous: boolean;
}

/** Auth with one user, whose token carries `claims`. */
function connect(
  user: FakeUser | null,
  claims: Record<string, unknown> = {},
  { provider = 'google.com', authTime = NOW - 60_000 } = {}
) {
  const auth = {
    currentUser: user,
    authStateReady: () => Promise.resolve(),
  };
  const authSdk = {
    getIdTokenResult: jest.fn(async () => ({
      claims,
      signInProvider: provider,
      authTime: new Date(authTime).toUTCString(),
    })),
    signInWithPopup: jest.fn(async () => {
      auth.currentUser = { uid: 'owner', isAnonymous: false };
    }),
    signOut: jest.fn(async () => {
      auth.currentUser = null;
    }),
    GoogleAuthProvider: class {},
    browserPopupRedirectResolver: {},
  };
  const connection = { auth, authSdk } as unknown as FirebaseConnection;
  TestBed.configureTestingModule({
    providers: [
      { provide: GameCloud, useValue: { firebase: () => connection } },
    ],
  });
  return { auth, authSdk };
}

const OWNER = { admin: true, email_verified: true };

describe('AdminAccessService', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('grants the owner, read from a fresh token', async () => {
    const { authSdk } = connect({ uid: 'owner', isAnonymous: false }, OWNER);
    const access = TestBed.inject(AdminAccessService);

    expect(await access.check()).toBe('granted');
    expect(authSdk.getIdTokenResult).toHaveBeenCalledWith(
      expect.anything(),
      true
    );
    expect(access.uid()).toBe('owner');
    expect(access.signedInLately(NOW)).toBe(true);
    expect(access.signedInLately(NOW + 3_600_000)).toBe(false);
  });

  it.each([
    ['no admin claim', { email_verified: true }, 'google.com'],
    ['an unverified email', { admin: true }, 'google.com'],
    ['another sign-in provider', OWNER, 'password'],
  ])('refuses %s', async (_, claims, provider) => {
    connect({ uid: 'someone', isAnonymous: false }, claims, { provider });
    const access = TestBed.inject(AdminAccessService);

    expect(await access.check()).toBe('no-access');
    expect(access.uid()).toBeNull();
  });

  it('asks a guest or nobody to sign in', async () => {
    connect({ uid: 'guest', isAnonymous: true }, OWNER);
    expect(await TestBed.inject(AdminAccessService).check()).toBe('signed-out');

    TestBed.resetTestingModule();
    connect(null);
    expect(await TestBed.inject(AdminAccessService).check()).toBe('signed-out');
  });

  it('has nothing to grant without a project', async () => {
    TestBed.configureTestingModule({
      providers: [{ provide: GameCloud, useValue: { firebase: () => null } }],
    });
    expect(await TestBed.inject(AdminAccessService).check()).toBe('no-project');
  });

  it('signs in with Google, then checks again', async () => {
    const { authSdk } = connect(null, OWNER);
    const access = TestBed.inject(AdminAccessService);

    expect(await access.signIn()).toBe(true);
    expect(authSdk.signInWithPopup).toHaveBeenCalled();
    expect(access.access()).toBe('granted');

    await access.signOut();
    expect(access.access()).toBe('signed-out');
    expect(access.signedInLately(NOW)).toBe(false);
  });

  it('says so when the sign-in fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { authSdk } = connect(null, OWNER);
    authSdk.signInWithPopup.mockRejectedValueOnce(new Error('closed'));

    expect(await TestBed.inject(AdminAccessService).signIn()).toBe(false);
  });
});
