import {
  NO_LEAGUE_FILTER,
  CLUB_GAMES_DAYS,
  type DbbRequest,
} from '@wolsok/feat-shared-basketball-data';
import {
  PROXY_ROUTES,
  proxyUrl,
  type AnyProxyRoute,
  type ProxyRouteInput,
} from './dbb-proxy-routes';

/** What h3 hands a route for `url`: the params its pattern names, the query. */
function inputAt(route: AnyProxyRoute, url: string): ProxyRouteInput {
  const parsed = new URL(url, 'http://localhost');
  const names = [...route.pattern.matchAll(/:(\w+)/g)].map(([, name]) => name);
  const matcher = new RegExp(`^${route.pattern.replace(/:\w+/g, '([^/]+)')}$`);
  const values = matcher.exec(parsed.pathname)?.slice(1) ?? [];
  return {
    params: Object.fromEntries(names.map((name, i) => [name, values[i]])),
    query: parsed.searchParams,
  };
}

/** The read `route` names for `url`. */
function readAt(route: AnyProxyRoute, url: string): DbbRequest | undefined {
  return route.readOf(inputAt(route, url));
}

const NIEDERSACHSEN_U12_JUGEND_MAENNLICH = {
  associationIds: [7],
  ageGroupIds: [12],
  ageGroupGenderIds: ['2_1'],
};

describe('DBB proxy routes', () => {
  it.each([
    [
      'the Liga search without a filter',
      { kind: 'league-search', filter: NO_LEAGUE_FILTER },
      '/api/dbb/ligen',
    ],
    [
      'the Liga search with a filter',
      { kind: 'league-search', filter: NIEDERSACHSEN_U12_JUGEND_MAENNLICH },
      '/api/dbb/ligen?verband=7&altersklasse=12&geschlecht=2_1',
    ],
    [
      'the Liga search with several values each',
      {
        kind: 'league-search',
        filter: {
          associationIds: [7, 10],
          ageGroupIds: [12, 14],
          ageGroupGenderIds: ['2_1', '2_2'],
        },
      },
      '/api/dbb/ligen?verband=7&verband=10&altersklasse=12&altersklasse=14&geschlecht=2_1&geschlecht=2_2',
    ],
    [
      'a later page of the Liga list',
      {
        kind: 'league-page',
        filter: NIEDERSACHSEN_U12_JUGEND_MAENNLICH,
        startIndex: 10,
      },
      '/api/dbb/ligen/seite?start=10&verband=7&altersklasse=12&geschlecht=2_1',
    ],
    [
      "a Liga's Spielplan",
      { kind: 'schedule', leagueId: 54862 },
      '/api/dbb/liga/54862/spielplan',
    ],
    [
      "a Team's Spiele",
      { kind: 'team-games', teamId: 313036 },
      '/api/dbb/team/313036/spiele',
    ],
    [
      "a Verein's Spiele of the weeks around today",
      { kind: 'club-games', clubId: 1837, days: CLUB_GAMES_DAYS },
      '/api/dbb/verein/1837/spiele',
    ],
    [
      "a Liga's Tabelle",
      { kind: 'standings', leagueId: 54862 },
      '/api/dbb/liga/54862/tabelle',
    ],
    [
      "a Spiel's match info",
      { kind: 'game-info', gameId: 2861436 },
      '/api/dbb/spiel/2861436',
    ],
    [
      "a Spiel's Spielbericht",
      { kind: 'game-report', gameId: 2861436 },
      '/api/dbb/spiel/2861436/bericht',
    ],
  ] as const)('maps %s to its URL and back', (_case, request, url) => {
    expect(proxyUrl(request)).toBe(url);
    expect(readAt(PROXY_ROUTES[request.kind], url)).toEqual(request);
  });

  it('names each route by its pattern', () => {
    expect(Object.values(PROXY_ROUTES).map((route) => route.pattern)).toEqual([
      '/api/dbb/ligen',
      '/api/dbb/ligen/seite',
      '/api/dbb/liga/:ligaId/spielplan',
      '/api/dbb/team/:teamId/spiele',
      '/api/dbb/verein/:vereinId/spiele',
      '/api/dbb/liga/:ligaId/tabelle',
      '/api/dbb/spiel/:spielId',
      '/api/dbb/spiel/:spielId/bericht',
    ]);
  });

  it("has no URL for a Verein's Spiele of another day range", () => {
    // the route reads the one range the adapter asks for, so it caches once
    expect(() =>
      proxyUrl({ kind: 'club-games', clubId: 1837, days: 7 })
    ).toThrow(RangeError);
  });

  it("takes no day range for a Verein's Spiele from the query", () => {
    expect(
      readAt(PROXY_ROUTES['club-games'], '/api/dbb/verein/1837/spiele?tage=7')
    ).toBeUndefined();
  });

  describe('id routes', () => {
    const ID_ROUTES = Object.values(PROXY_ROUTES).filter((route) =>
      route.pattern.includes(':')
    );

    it.each(['', 'abc', '-1', '0', '1.5', '99999999999999999999'])(
      'name no read for the id %j',
      (id) => {
        for (const route of ID_ROUTES) {
          const param = /:(\w+)/.exec(route.pattern)?.[1] ?? '';
          expect(
            route.readOf({
              params: { [param]: id },
              query: new URLSearchParams(),
            })
          ).toBeUndefined();
        }
      }
    );

    it.each(['anything=x', 'verband=7', 'start=10'])(
      'name no read with a query, here %s',
      (query) => {
        for (const route of ID_ROUTES) {
          const param = /:(\w+)/.exec(route.pattern)?.[1] ?? '';
          expect(
            route.readOf({
              params: { [param]: '54862' },
              query: new URLSearchParams(query),
            })
          ).toBeUndefined();
        }
      }
    );

    it('name no read without their id', () => {
      for (const route of ID_ROUTES) {
        expect(
          route.readOf({ params: {}, query: new URLSearchParams() })
        ).toBeUndefined();
      }
    });
  });

  describe('the Liga search', () => {
    const search = PROXY_ROUTES['league-search'];
    const page = PROXY_ROUTES['league-page'];

    it.each([
      ['a non-numeric Verband', 'verband=abc'],
      ['a Verband of 0', 'verband=0'],
      ['a negative Verband', 'verband=-1'],
      ['a fractional age group', 'altersklasse=1.5'],
      ['an empty age group', 'altersklasse='],
      ['a gender without its age group category', 'geschlecht=1'],
      ['a gender of letters', 'geschlecht=2_m'],
      ['a gender with a third part', 'geschlecht=2_1_1'],
      ['a start index, which only a later page takes', 'start=10'],
      ['a parameter it does not know', 'verband=7&sort=1'],
    ])('names no search for %s', (_case, query) => {
      expect(readAt(search, `/api/dbb/ligen?${query}`)).toBeUndefined();
    });

    it.each([
      ['no start index', 'verband=7'],
      ['a negative start index', 'start=-10'],
      ['a non-numeric start index', 'start=zehn'],
      ['a fractional start index', 'start=1.5'],
      ['two start indexes', 'start=10&start=20'],
      ['a bad filter', 'start=10&geschlecht=2'],
    ])('names no later page for %s', (_case, query) => {
      expect(readAt(page, `/api/dbb/ligen/seite?${query}`)).toBeUndefined();
    });

    it('takes the first page as a page too', () => {
      expect(readAt(page, '/api/dbb/ligen/seite?start=0')).toEqual({
        kind: 'league-page',
        filter: NO_LEAGUE_FILTER,
        startIndex: 0,
      });
    });
  });
});
