import { describe, expect, it, jest } from '@jest/globals';
import { CloudflareApi } from './cloudflare-api';

function answering(status: number, body: unknown) {
  return jest.fn<typeof fetch>(
    async () => new Response(JSON.stringify(body), { status })
  );
}

describe('CloudflareApi', () => {
  it("calls the account's TURN keys with the token", async () => {
    const fetch = answering(200, {
      success: true,
      result: [{ uid: 'k1', name: 'bacteria-wars-online' }],
    });

    const keys = await new CloudflareApi('account-token', fetch).turnKeys(
      'acc'
    );

    expect(keys).toEqual([{ uid: 'k1', name: 'bacteria-wars-online' }]);
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe(
      'https://api.cloudflare.com/client/v4/accounts/acc/calls/turn_keys'
    );
    expect(new Headers(init?.headers).get('Authorization')).toBe(
      'Bearer account-token'
    );
  });

  it('sends the name of a new key', async () => {
    const fetch = answering(201, {
      success: true,
      result: { uid: 'k2', secret: 's' },
    });

    expect(
      await new CloudflareApi('t', fetch).createTurnKey('acc', 'name')
    ).toEqual({ uid: 'k2', secret: 's' });
    const body = fetch.mock.calls[0]?.[1]?.body;
    expect(JSON.parse(typeof body === 'string' ? body : '')).toEqual({
      name: 'name',
    });
  });

  it("throws with Cloudflare's messages, never the token", async () => {
    const api = new CloudflareApi(
      'account-token',
      answering(403, {
        success: false,
        errors: [{ message: 'Authentication error' }],
      })
    );

    const refused = api.accounts();
    await expect(refused).rejects.toThrow(
      'Cloudflare GET /accounts answered 403: Authentication error'
    );
    await expect(refused).rejects.not.toThrow(/account-token/);
  });
});
