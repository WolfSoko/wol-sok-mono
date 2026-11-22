import { settleLink } from './link';

describe('settleLink', () => {
  const guest = { uid: 'guest', hasProvider: false };
  const google = { uid: 'google', hasProvider: true };
  const playGamesOnly = { uid: 'pg', hasProvider: false };
  const otherGoogle = { uid: 'other', hasProvider: true };

  it('links a player without a link to the writer', () => {
    expect(settleLink({ writer: guest, linked: null })).toEqual({
      kind: 'link',
      uid: 'guest',
    });
    expect(settleLink({ writer: google, linked: null })).toEqual({
      kind: 'link',
      uid: 'google',
    });
  });

  it('keeps a link to the writer', () => {
    expect(settleLink({ writer: google, linked: google })).toEqual({
      kind: 'keep',
      uid: 'google',
    });
  });

  it('hands a guest the account the player is linked to', () => {
    expect(settleLink({ writer: guest, linked: otherGoogle })).toEqual({
      kind: 'take-over',
      uid: 'other',
    });
    expect(settleLink({ writer: guest, linked: playGamesOnly })).toEqual({
      kind: 'take-over',
      uid: 'pg',
    });
  });

  it('refuses a Google writer while another account holds the player', () => {
    expect(settleLink({ writer: google, linked: otherGoogle })).toEqual({
      kind: 'refuse',
    });
    // Its progress may never have joined the writer: the link stays.
    expect(settleLink({ writer: google, linked: playGamesOnly })).toEqual({
      kind: 'refuse',
    });
  });
});
