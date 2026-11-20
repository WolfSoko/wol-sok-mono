import { parseRelayCredentials, RELAY_COLLECTION, RELAY_DOC_ID } from './relay';
import type { ToMillis } from './ban';

/** A stored time as the sides hand it over: here, a number of ms. */
const toMillis: ToMillis = (value) =>
  typeof value === 'number' ? value : null;

const stored = {
  urls: ['turn:turn.cloudflare.com:3478?transport=udp'],
  username: 'user',
  credential: 'secret',
  expireAt: 9_000,
  refreshedAt: 1_000,
};

describe('parseRelayCredentials', () => {
  it('reads the credentials as refreshRelay stores them', () => {
    expect(parseRelayCredentials(stored, toMillis)).toEqual({
      urls: ['turn:turn.cloudflare.com:3478?transport=udp'],
      username: 'user',
      credential: 'secret',
      expireAt: 9_000,
    });
  });

  it('keeps only the urls that are strings', () => {
    expect(
      parseRelayCredentials(
        { ...stored, urls: ['turns:turn.cloudflare.com:443', 7, null] },
        toMillis
      )?.urls
    ).toEqual(['turns:turn.cloudflare.com:443']);
  });

  it.each([
    ['no document', undefined],
    ['no object', 'turn'],
    ['no urls', { ...stored, urls: [] }],
    ['urls that are no list', { ...stored, urls: 'turn:x' }],
    ['no username', { ...stored, username: undefined }],
    ['an empty username', { ...stored, username: '' }],
    ['no credential', { ...stored, credential: 3 }],
    ['no expiry', { ...stored, expireAt: 'soon' }],
  ])('reads %s as none', (_case, data) => {
    expect(parseRelayCredentials(data, toMillis)).toBeNull();
  });
});

describe('the relay document', () => {
  it('lives at relay/turn', () => {
    expect(`${RELAY_COLLECTION}/${RELAY_DOC_ID}`).toBe('relay/turn');
  });
});
