import {
  PROXY_ROUTES,
  TABELLE_ROUTE,
  TEAM_SPIELE_ROUTE,
  proxyPath,
  proxyRouteRead,
  routerPath,
} from './dbb-proxy-routes';

describe('DBB proxy routes', () => {
  it.each([
    [
      "a Team's Spiele",
      TEAM_SPIELE_ROUTE,
      { kind: 'team-spiele', teamId: 313036 },
      '/api/dbb/team/313036/spiele',
    ],
    [
      "a Liga's Tabelle",
      TABELLE_ROUTE,
      { kind: 'tabelle', ligaId: 54862 },
      '/api/dbb/liga/54862/tabelle',
    ],
  ] as const)(
    'maps %s to its route and back',
    (_case, route, request, path) => {
      expect(proxyPath(request)).toBe(path);
      expect(proxyRouteRead(route, path.split('/')[4])).toEqual(request);
    }
  );

  it('names each route by its param, as h3 and the route folder do', () => {
    expect(PROXY_ROUTES.map(routerPath)).toEqual([
      '/api/dbb/team/:teamId/spiele',
      '/api/dbb/liga/:ligaId/tabelle',
    ]);
  });

  it.each([undefined, '', 'abc', '-1', '0', '1.5'])(
    'names no read for the id %j',
    (id) => {
      for (const route of PROXY_ROUTES) {
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
