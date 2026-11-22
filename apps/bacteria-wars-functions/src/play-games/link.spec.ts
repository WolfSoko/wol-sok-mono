import { settleLink } from './link';

describe('settleLink', () => {
  const guest = { uid: 'guest', hasProvider: false };
  const google = { uid: 'google', hasProvider: true };

  it('links a player without a link to the writer', () => {
    expect(settleLink({ writer: guest, linkedUid: null })).toEqual({
      kind: 'link',
      uid: 'guest',
    });
    expect(settleLink({ writer: google, linkedUid: null })).toEqual({
      kind: 'link',
      uid: 'google',
    });
  });

  it('keeps a link to the writer', () => {
    expect(settleLink({ writer: google, linkedUid: 'google' })).toEqual({
      kind: 'keep',
      uid: 'google',
    });
  });

  it('hands a guest the account the player is linked to', () => {
    expect(settleLink({ writer: guest, linkedUid: 'other' })).toEqual({
      kind: 'take-over',
      uid: 'other',
    });
  });

  it('refuses a writer with a sign-in of its own linked elsewhere', () => {
    expect(settleLink({ writer: google, linkedUid: 'other' })).toEqual({
      kind: 'refuse',
    });
  });
});
