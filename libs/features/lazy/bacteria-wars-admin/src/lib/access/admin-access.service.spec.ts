import { TestBed } from '@angular/core/testing';
import {
  FakeFirebase,
  type FakeUser,
  fakeToken,
  googleUser,
  guestUser,
  provideFakeGameCloud,
} from '@wolsok/feat-lazy-bac-game/testing';
import { AdminAccessService } from './admin-access.service';

const NOW = Date.UTC(2026, 9, 25, 12);

/** Auth with one user, whose token carries `claims`. */
function connect(
  user: FakeUser | null,
  claims: Record<string, unknown> = {},
  { provider = 'google.com', authTime = NOW - 60_000 } = {}
) {
  const fake = new FakeFirebase();
  const auth = fake.auth;
  const token = fakeToken(claims, { signInProvider: provider, authTime });
  auth.currentUser = user;
  // The token a Google sign-in as the owner brings, too.
  auth.tokens.set('owner', token);
  if (user !== null) {
    auth.tokens.set(user.uid, token);
  }
  auth.signInWithPopup.mockImplementation(async () =>
    auth.become(googleUser('owner', 'Owner'))
  );
  TestBed.configureTestingModule({
    providers: [provideFakeGameCloud({ firebase: fake.connection() })],
  });
  return auth;
}

const OWNER = { admin: true, email_verified: true };

describe('AdminAccessService', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('grants the owner, read from a fresh token', async () => {
    const auth = connect(googleUser('owner', 'Owner'), OWNER);
    const access = TestBed.inject(AdminAccessService);

    expect(await access.check()).toBe('granted');
    expect(auth.getIdTokenResult).toHaveBeenCalledWith(expect.anything(), true);
    expect(access.uid()).toBe('owner');
    expect(access.signedInLately(NOW)).toBe(true);
    expect(access.signedInLately(NOW + 3_600_000)).toBe(false);
  });

  it.each([
    ['no admin claim', { email_verified: true }, 'google.com'],
    ['an unverified email', { admin: true }, 'google.com'],
    ['another sign-in provider', OWNER, 'password'],
  ])('refuses %s', async (_, claims, provider) => {
    connect(googleUser('someone', 'Someone'), claims, { provider });
    const access = TestBed.inject(AdminAccessService);

    expect(await access.check()).toBe('no-access');
    expect(access.uid()).toBeNull();
  });

  it('asks a guest or nobody to sign in', async () => {
    connect(guestUser('guest'), OWNER);
    expect(await TestBed.inject(AdminAccessService).check()).toBe('signed-out');

    TestBed.resetTestingModule();
    connect(null);
    expect(await TestBed.inject(AdminAccessService).check()).toBe('signed-out');
  });

  it('has nothing to grant without a project', async () => {
    TestBed.configureTestingModule({ providers: [provideFakeGameCloud()] });
    expect(await TestBed.inject(AdminAccessService).check()).toBe('no-project');
  });

  it('signs in with Google, then checks again', async () => {
    const auth = connect(null, OWNER);
    const access = TestBed.inject(AdminAccessService);

    expect(await access.signIn()).toBe(true);
    expect(auth.signInWithPopup).toHaveBeenCalled();
    expect(access.access()).toBe('granted');

    await access.signOut();
    expect(access.access()).toBe('signed-out');
    expect(access.signedInLately(NOW)).toBe(false);
  });

  it('says so when the sign-in fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const auth = connect(null, OWNER);
    auth.signInWithPopup.mockRejectedValueOnce(new Error('closed'));

    expect(await TestBed.inject(AdminAccessService).signIn()).toBe(false);
  });
});
