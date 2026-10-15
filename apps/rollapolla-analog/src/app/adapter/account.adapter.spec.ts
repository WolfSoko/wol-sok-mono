import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Auth } from '@angular/fire/auth';
import * as fireAuth from '@angular/fire/auth';
import { firstValueFrom, of } from 'rxjs';
import { SignInCancelled } from '../ports/account.port';
import { AccountAdapter } from './account.adapter';

vi.mock('@angular/fire/auth', async (importOriginal) => {
  const original = await importOriginal<typeof fireAuth>();
  return {
    ...original,
    linkWithPopup: vi.fn(),
    updateProfile: vi.fn(),
    signInWithPopup: vi.fn(),
    signInWithCredential: vi.fn(),
    signOut: vi.fn(),
    user: vi.fn(() => of(null)),
  };
});

describe('AccountAdapter', () => {
  const anonymousUser = {
    uid: 'anon-uid',
    isAnonymous: true,
    displayName: null,
    photoURL: null,
    providerData: [],
  };
  let auth: { currentUser: unknown; authStateReady: () => Promise<void> };

  function createAdapter(platform = 'browser'): AccountAdapter {
    TestBed.configureTestingModule({
      providers: [
        AccountAdapter,
        { provide: Auth, useValue: auth },
        { provide: PLATFORM_ID, useValue: platform },
      ],
    });
    return TestBed.inject(AccountAdapter);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fireAuth.linkWithPopup).mockResolvedValue({
      user: { ...anonymousUser, displayName: 'set', providerData: [] },
    } as unknown as fireAuth.UserCredential);
    auth = {
      currentUser: anonymousUser,
      authStateReady: async () => undefined,
    };
  });

  it('links an anonymous visitor to Google, keeping the uid', async () => {
    await createAdapter().signInWithGoogle();

    expect(fireAuth.linkWithPopup).toHaveBeenCalledWith(
      anonymousUser,
      expect.any(fireAuth.GoogleAuthProvider)
    );
    expect(fireAuth.signInWithCredential).not.toHaveBeenCalled();
  });

  it('switches to the Google account when it is already in use', async () => {
    const credential = { providerId: 'google.com' };
    vi.mocked(fireAuth.linkWithPopup).mockRejectedValueOnce({
      code: 'auth/credential-already-in-use',
    });
    vi.spyOn(
      fireAuth.GoogleAuthProvider,
      'credentialFromError'
    ).mockReturnValue(credential as fireAuth.OAuthCredential);

    await createAdapter().signInWithGoogle();

    expect(fireAuth.signInWithCredential).toHaveBeenCalledWith(
      auth,
      credential
    );
  });

  it('signs in with a popup when nobody is signed in', async () => {
    auth.currentUser = null;

    await createAdapter().signInWithGoogle();

    expect(fireAuth.signInWithPopup).toHaveBeenCalled();
    expect(fireAuth.linkWithPopup).not.toHaveBeenCalled();
  });

  it('reports a closed popup as cancelled', async () => {
    vi.mocked(fireAuth.linkWithPopup).mockRejectedValueOnce({
      code: 'auth/popup-closed-by-user',
    });

    await expect(createAdapter().signInWithGoogle()).rejects.toBeInstanceOf(
      SignInCancelled
    );
  });

  it('passes other errors on', async () => {
    const error = { code: 'auth/unauthorized-domain' };
    vi.mocked(fireAuth.linkWithPopup).mockRejectedValueOnce(error);

    await expect(createAdapter().signInWithGoogle()).rejects.toBe(error);
  });

  it('never touches auth on the server', async () => {
    const account = await firstValueFrom(createAdapter('server').account$);

    expect(account).toBeNull();
    expect(fireAuth.user).not.toHaveBeenCalled();
  });
});
