import {
  parseDbbId,
  type DbbRequest,
} from '@wolsok/feat-shared-basketball-data';

/**
 * One of the app's proxy routes (`src/server/routes/api/dbb/`): a read by
 * one numeric id. The one place that names its path and param; its route
 * file lies at `path` with the param as folder (`team/[teamId]/spiele.get.ts`).
 */
export interface ProxyRoute {
  /** The id's param, as h3 and the route folder `[param]` name it. */
  readonly param: string;
  /** The route's path for `id`: a number, or a param pattern. */
  readonly path: (id: number | string) => string;
  /** The read the id names. */
  readonly read: (id: number) => DbbRequest;
}

/** `GET /api/dbb/team/{teamId}/spiele`: a Team's Spiele of the Saison. */
export const TEAM_SPIELE_ROUTE: ProxyRoute = {
  param: 'teamId',
  path: (teamId) => `/api/dbb/team/${teamId}/spiele`,
  read: (teamId) => ({ kind: 'team-spiele', teamId }),
};

/** `GET /api/dbb/liga/{ligaId}/tabelle`: a Liga's Tabelle. */
export const TABELLE_ROUTE: ProxyRoute = {
  param: 'ligaId',
  path: (ligaId) => `/api/dbb/liga/${ligaId}/tabelle`,
  read: (ligaId) => ({ kind: 'tabelle', ligaId }),
};

/**
 * Every proxy route. A read gets its route here, its route file and its
 * place in `KorbjaegerData`.
 */
export const PROXY_ROUTES: readonly ProxyRoute[] = [
  TEAM_SPIELE_ROUTE,
  TABELLE_ROUTE,
];

/** The path the browser asks `request` at. */
export function proxyPath(request: DbbRequest): string {
  switch (request.kind) {
    case 'team-spiele':
      return TEAM_SPIELE_ROUTE.path(request.teamId);
    case 'tabelle':
      return TABELLE_ROUTE.path(request.ligaId);
    case 'liga-suche':
    case 'liga-seite':
    case 'spielplan':
    case 'vereins-spiele':
    case 'spiel-info':
    case 'spielbericht':
      // unreachable: KorbjaegerData offers no read without a route
      throw new Error(`no proxy route for ${request.kind} yet`);
  }
}

/** The read `route` names for its param's value; `undefined`: 404. */
export function proxyRouteRead(
  route: ProxyRoute,
  id: string | undefined
): DbbRequest | undefined {
  const dbbId = parseDbbId(id);
  return dbbId === undefined ? undefined : route.read(dbbId);
}

/** `route`'s path as a router pattern, `/api/dbb/team/:teamId/spiele`. */
export function routerPath(route: ProxyRoute): string {
  return route.path(`:${route.param}`);
}
