import {
  parseRelayCredentials,
  parseTurnKey,
  RELAY_COLLECTION,
  RELAY_DOC_ID,
  relayCredentialsUrl,
  relayEntry,
} from './relay';
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

/** Cloudflare's answer to `generate-ice-servers`, as its docs show it. */
const generated = {
  iceServers: [
    { urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.cloudflare.com:53'] },
    {
      urls: [
        'turn:turn.cloudflare.com:3478?transport=udp',
        'turn:turn.cloudflare.com:53?transport=udp',
        'turn:turn.cloudflare.com:3478?transport=tcp',
        'turns:turn.cloudflare.com:5349?transport=tcp',
        'turns:turn.cloudflare.com:443?transport=tcp',
      ],
      username: 'user',
      credential: 'secret',
    },
  ],
};

describe('relayEntry', () => {
  it('takes the TURN server, without the URLs on port 53', () => {
    expect(relayEntry(generated)).toEqual({
      urls: [
        'turn:turn.cloudflare.com:3478?transport=udp',
        'turn:turn.cloudflare.com:3478?transport=tcp',
        'turns:turn.cloudflare.com:5349?transport=tcp',
        'turns:turn.cloudflare.com:443?transport=tcp',
      ],
      username: 'user',
      credential: 'secret',
    });
  });

  it('takes a single URL given as a string', () => {
    expect(
      relayEntry({
        iceServers: [
          {
            urls: 'turn:turn.cloudflare.com:3478',
            username: 'u',
            credential: 'c',
          },
        ],
      })?.urls
    ).toEqual(['turn:turn.cloudflare.com:3478']);
  });

  it.each([
    ['no servers', {}],
    ['STUN only', { iceServers: [generated.iceServers[0]] }],
    [
      'a TURN server without a password',
      { iceServers: [{ urls: ['turn:x:3478'], username: 'u' }] },
    ],
    [
      'a TURN server on port 53 only',
      {
        iceServers: [
          { urls: ['turn:x:53?transport=udp'], username: 'u', credential: 'c' },
        ],
      },
    ],
  ])('finds none in %s', (_case, answer) => {
    expect(relayEntry(answer)).toBeNull();
  });
});

describe('relayCredentialsUrl', () => {
  it("names the key's credentials endpoint", () => {
    expect(relayCredentialsUrl('key-id')).toBe(
      'https://rtc.live.cloudflare.com/v1/turn/keys/key-id/credentials/generate-ice-servers'
    );
  });
});

describe('parseTurnKey', () => {
  it('reads the secret the provisioning tool stores', () => {
    expect(parseTurnKey('{"id":"key-id","token":"key-token"}')).toEqual({
      id: 'key-id',
      token: 'key-token',
    });
  });

  it.each(['', 'key-token', '{"id":"key-id"}', '{"id":1,"token":"t"}'])(
    'refuses %j without repeating it',
    (secret) => {
      expect(() => parseTurnKey(secret)).toThrow(
        'CLOUDFLARE_TURN_KEY is no {"id","token"} JSON.'
      );
    }
  );
});
