import { fetchRelay, parseTurnKey } from './fetch-relay';

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

const key = { id: 'key-id', token: 'key-token' };

/** A `fetch` that answers `status` with `body` and keeps what it was asked. */
function fakeFetch(status: number, body: unknown) {
  return jest.fn<Promise<Response>, Parameters<typeof fetch>>(
    async () => new Response(JSON.stringify(body), { status })
  );
}

describe('fetchRelay', () => {
  it("asks for credentials of the given lifetime with the key's token", async () => {
    const fetch = fakeFetch(201, generated);
    await fetchRelay(key, 3600, fetch);
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe(
      'https://rtc.live.cloudflare.com/v1/turn/keys/key-id/credentials/generate-ice-servers'
    );
    expect(init?.method).toBe('POST');
    expect(new Headers(init?.headers).get('Authorization')).toBe(
      'Bearer key-token'
    );
    const body = init?.body;
    expect(JSON.parse(typeof body === 'string' ? body : '')).toEqual({
      ttl: 3600,
    });
  });

  it('answers the TURN entry', async () => {
    expect(
      (await fetchRelay(key, 3600, fakeFetch(201, generated))).username
    ).toBe('user');
  });

  it("throws on a refusal, without the token or Cloudflare's text", async () => {
    const refused = fetchRelay(
      key,
      3600,
      fakeFetch(401, { error: 'key-token' })
    );
    await expect(refused).rejects.toThrow(
      'Cloudflare refused the TURN credentials (401).'
    );
    await expect(refused).rejects.not.toThrow(/key-token/);
  });

  it('throws on an answer without a TURN server', async () => {
    await expect(
      fetchRelay(key, 3600, fakeFetch(201, { iceServers: [] }))
    ).rejects.toThrow('Cloudflare answered no TURN server.');
  });
});

describe('parseTurnKey', () => {
  it('reads the secret the provisioning tool stores', () => {
    expect(parseTurnKey('{"id":"key-id","token":"key-token"}')).toEqual(key);
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
