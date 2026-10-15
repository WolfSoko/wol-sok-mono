import * as fireAuth from '@angular/fire/auth';
import { adoptGoogleProfile } from './ensure-signed-in';

vi.mock('@angular/fire/auth', async (importOriginal) => {
  const original = await importOriginal<typeof fireAuth>();
  return { ...original, updateProfile: vi.fn() };
});

describe('adoptGoogleProfile', () => {
  function user(overrides: Partial<fireAuth.User>): fireAuth.User {
    return {
      displayName: null,
      photoURL: null,
      providerData: [],
      getIdToken: vi.fn(),
      ...overrides,
    } as unknown as fireAuth.User;
  }

  beforeEach(() => vi.clearAllMocks());

  it('copies the Google name and photo and refreshes the token', async () => {
    const linked = user({
      providerData: [
        {
          providerId: 'google.com',
          displayName: 'Ada Lovelace',
          photoURL: 'https://example.com/ada.png',
        } as fireAuth.UserInfo,
      ],
    });

    await adoptGoogleProfile(linked);

    expect(fireAuth.updateProfile).toHaveBeenCalledWith(linked, {
      displayName: 'Ada Lovelace',
      photoURL: 'https://example.com/ada.png',
    });
    expect(linked.getIdToken).toHaveBeenCalledWith(true);
  });

  it('sends no photo when Google has none', async () => {
    const linked = user({
      providerData: [
        {
          providerId: 'google.com',
          displayName: 'Ada',
          photoURL: null,
        } as fireAuth.UserInfo,
      ],
    });

    await adoptGoogleProfile(linked);

    expect(fireAuth.updateProfile).toHaveBeenCalledWith(linked, {
      displayName: 'Ada',
    });
  });

  it('never fails the caller', async () => {
    vi.mocked(fireAuth.updateProfile).mockRejectedValueOnce(new Error('400'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const linked = user({
      providerData: [
        { providerId: 'google.com', displayName: 'Ada' } as fireAuth.UserInfo,
      ],
    });

    await expect(adoptGoogleProfile(linked)).resolves.toBe(linked);
  });

  it('leaves a profile that already has a name alone', async () => {
    const signedIn = user({
      displayName: 'Ada',
      providerData: [
        {
          providerId: 'google.com',
          displayName: 'Ada Lovelace',
        } as fireAuth.UserInfo,
      ],
    });

    await adoptGoogleProfile(signedIn);

    expect(fireAuth.updateProfile).not.toHaveBeenCalled();
  });

  it('leaves anonymous users alone', async () => {
    const anonymous = user({});

    await adoptGoogleProfile(anonymous);

    expect(fireAuth.updateProfile).not.toHaveBeenCalled();
    expect(anonymous.getIdToken).not.toHaveBeenCalled();
  });
});
