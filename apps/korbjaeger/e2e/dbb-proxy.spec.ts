import { expect, test } from '@playwright/test';

// The proxy as Nitro's file routing serves it, which its specs mount by hand.
test.describe('DBB proxy', () => {
  for (const [what, path] of [
    ["a Team's Spiele", '/api/dbb/team/313036/spiele'],
    ["a Liga's Tabelle", '/api/dbb/liga/54862/tabelle'],
    ["a Spiel's match info", '/api/dbb/spiel/2861436'],
    ['a Spielbericht not confirmed yet', '/api/dbb/spiel/2861436/bericht'],
    ['the Liga search', '/api/dbb/ligen?verband=7&altersklasse=12'],
    [
      'a later page of Ligen',
      '/api/dbb/ligen/seite?start=10&verband=7&altersklasse=12&geschlecht=2_1',
    ],
    ["a Liga's Spielplan", '/api/dbb/liga/54862/spielplan'],
  ] as const) {
    test(`serves ${what}, cached`, async ({ request }) => {
      const response = await request.get(path);

      expect(response.status()).toBe(200);
      expect(response.headers()['cache-control']).toBe(
        'public, max-age=60, s-maxage=300'
      );
    });
  }

  test("lets the CDN keep a confirmed Spiel's Spielbericht an hour", async ({
    request,
  }) => {
    const response = await request.get('/api/dbb/spiel/2843811/bericht');

    expect(response.status()).toBe(200);
    expect(response.headers()['cache-control']).toBe(
      'public, max-age=60, s-maxage=3600'
    );
  });

  for (const [what, method, path] of [
    ['a POST to the read', 'POST', '/api/dbb/team/313036/spiele'],
    ['the bare prefix', 'GET', '/api/dbb'],
    ['an unknown read', 'GET', '/api/dbb/team/313036/spieler'],
    ['a non-numeric Liga', 'GET', '/api/dbb/liga/abc/tabelle'],
    ['a POST to the Liga search', 'POST', '/api/dbb/ligen'],
    ['a malformed gender', 'GET', '/api/dbb/ligen?geschlecht=2'],
    ['a read with a query', 'GET', '/api/dbb/team/313036/spiele?anything=x'],
  ] as const) {
    test(`answers ${what} with 404, not cached`, async ({ request }) => {
      const response = await request.fetch(path, { method });

      expect(response.status()).toBe(404);
      expect(response.headers()['cache-control']).toBeUndefined();
    });
  }

  // ADR 0019: Hosting adds the header too; the function sets it itself, so
  // it holds whether or not Hosting's headers reach a rewritten response.
  for (const [what, path] of [
    ['a read', '/api/dbb/team/313036/spiele'],
    ['an unknown read', '/api/dbb/team/313036/spieler'],
  ] as const) {
    test(`marks ${what} noindex`, async ({ request }) => {
      const response = await request.get(path);

      expect(response.headers()['x-robots-tag']).toBe('noindex');
    });
  }
});
