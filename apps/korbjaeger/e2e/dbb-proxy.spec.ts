import { expect, test } from '@playwright/test';

// The proxy as Nitro's file routing serves it, which its specs mount by hand.
test.describe('DBB proxy', () => {
  test("serves a Team's Spiele, cached", async ({ request }) => {
    const response = await request.get('/api/dbb/team/313036/spiele');

    expect(response.status()).toBe(200);
    expect(response.headers()['cache-control']).toBe(
      'public, max-age=60, s-maxage=300'
    );
  });

  for (const [what, method, path] of [
    ['a POST to the read', 'POST', '/api/dbb/team/313036/spiele'],
    ['the bare prefix', 'GET', '/api/dbb'],
    ['an unknown read', 'GET', '/api/dbb/team/313036/spieler'],
  ] as const) {
    test(`answers ${what} with 404, not cached`, async ({ request }) => {
      const response = await request.fetch(path, { method });

      expect(response.status()).toBe(404);
      expect(response.headers()['cache-control']).toBeUndefined();
    });
  }
});
