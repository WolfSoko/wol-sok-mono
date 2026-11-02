import { isOwnerToken } from './owner-token';

describe('isOwnerToken', () => {
  const owner = {
    claims: { admin: true, email_verified: true },
    signInProvider: 'google.com',
  };

  it('takes the admin claim with a verified email and a Google sign-in', () => {
    expect(isOwnerToken(owner)).toBe(true);
  });

  it('refuses a token that lacks any of the three', () => {
    expect(
      isOwnerToken({
        ...owner,
        claims: { admin: 'true', email_verified: true },
      })
    ).toBe(false);
    expect(
      isOwnerToken({ ...owner, claims: { admin: true, email_verified: false } })
    ).toBe(false);
    expect(isOwnerToken({ ...owner, signInProvider: 'password' })).toBe(false);
    expect(isOwnerToken({ ...owner, signInProvider: null })).toBe(false);
  });
});
