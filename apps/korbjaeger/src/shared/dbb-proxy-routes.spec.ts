import {
  PROXY_ROUTES,
  paramOf,
  proxyPath,
  proxyRouteRead,
} from './dbb-proxy-routes';

describe('DBB proxy routes', () => {
  it.each([
    [
      "a Team's Spiele",
      { kind: 'team-spiele', teamId: 313036 },
      '/api/dbb/team/313036/spiele',
      '313036',
    ],
    [
      "a Liga's Tabelle",
      { kind: 'tabelle', ligaId: 54862 },
      '/api/dbb/liga/54862/tabelle',
      '54862',
    ],
    [
      "a Spiel's match info",
      { kind: 'spiel-info', spielId: 2861436 },
      '/api/dbb/spiel/2861436',
      '2861436',
    ],
    [
      "a Spiel's Spielbericht",
      { kind: 'spielbericht', spielId: 2861436 },
      '/api/dbb/spiel/2861436/bericht',
      '2861436',
    ],
  ] as const)('maps %s to its route and back', (_case, request, path, id) => {
    expect(proxyPath(request)).toBe(path);
    expect(proxyRouteRead(PROXY_ROUTES[request.kind], id)).toEqual(request);
  });

  it('names each route by its pattern, its param the read id', () => {
    expect(
      Object.values(PROXY_ROUTES).map((route) => [
        route.pattern,
        paramOf(route),
      ])
    ).toEqual([
      ['/api/dbb/team/:teamId/spiele', 'teamId'],
      ['/api/dbb/liga/:ligaId/tabelle', 'ligaId'],
      ['/api/dbb/spiel/:spielId', 'spielId'],
      ['/api/dbb/spiel/:spielId/bericht', 'spielId'],
    ]);
  });

  it.each([undefined, '', 'abc', '-1', '0', '1.5'])(
    'names no read for the id %j',
    (id) => {
      for (const route of Object.values(PROXY_ROUTES)) {
        expect(proxyRouteRead(route, id)).toBeUndefined();
      }
    }
  );

  it('has no route for a read the app does not offer yet', () => {
    expect(() => proxyPath({ kind: 'spielplan', ligaId: 54308 })).toThrow(
      'no proxy route for spielplan yet'
    );
  });
});
