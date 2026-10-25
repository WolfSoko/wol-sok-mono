import { isOwnerRecord, type OwnerRecord } from './command';

describe('isOwnerRecord', () => {
  const owner: OwnerRecord = {
    customClaims: { admin: true },
    emailVerified: true,
    providerData: [{ providerId: 'google.com' }],
  };

  it('takes the admin claim on a verified Google account', () => {
    expect(isOwnerRecord(owner)).toBe(true);
  });

  it.each<[string, Partial<OwnerRecord>]>([
    ['no claim', { customClaims: undefined }],
    ['a claim that is not true', { customClaims: { admin: 'yes' } }],
    ['an unverified email', { emailVerified: false }],
    ['no Google provider', { providerData: [{ providerId: 'password' }] }],
  ])('refuses %s', (_, change) => {
    expect(isOwnerRecord({ ...owner, ...change })).toBe(false);
  });
});
