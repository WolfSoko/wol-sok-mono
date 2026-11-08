import {
  parseDbbId,
  type DbbRequest,
} from '@wolsok/feat-shared-basketball-data';

/** The reads the app's proxy has a route for. */
export type ProxyKind =
  | 'team-spiele'
  | 'tabelle'
  | 'spiel-info'
  | 'spielbericht';

/** The read of kind `K`. */
export type ProxyRead<K extends ProxyKind> = Extract<DbbRequest, { kind: K }>;

/** What a route file and the proxy need of any route. */
export interface AnyProxyRoute {
  /** The path as h3 and Nitro route it, its id as `:param`. */
  readonly pattern: string;
  /** The read the route's id names. */
  readonly read: (id: number) => DbbRequest;
}

/**
 * One of the app's proxy routes (`src/server/routes/api/dbb/`): a read by
 * one numeric id. Its route file lies at its pattern with the param as
 * folder (`team/[teamId]/spiele.get.ts`).
 */
export interface ProxyRoute<K extends ProxyKind> extends AnyProxyRoute {
  readonly read: (id: number) => ProxyRead<K>;
  /** The id a read of the route names. */
  readonly id: (read: ProxyRead<K>) => number;
}

/**
 * Every proxy route, by the kind of read it serves: the one place that
 * names a route. A read gets its entry here, its route file and its place
 * in `KorbjaegerData`.
 */
export const PROXY_ROUTES: { readonly [K in ProxyKind]: ProxyRoute<K> } = {
  'team-spiele': {
    pattern: '/api/dbb/team/:teamId/spiele',
    read: (teamId) => ({ kind: 'team-spiele', teamId }),
    id: ({ teamId }) => teamId,
  },
  tabelle: {
    pattern: '/api/dbb/liga/:ligaId/tabelle',
    read: (ligaId) => ({ kind: 'tabelle', ligaId }),
    id: ({ ligaId }) => ligaId,
  },
  'spiel-info': {
    pattern: '/api/dbb/spiel/:spielId',
    read: (spielId) => ({ kind: 'spiel-info', spielId }),
    id: ({ spielId }) => spielId,
  },
  spielbericht: {
    pattern: '/api/dbb/spiel/:spielId/bericht',
    read: (spielId) => ({ kind: 'spielbericht', spielId }),
    id: ({ spielId }) => spielId,
  },
};

/** The param of `route`'s pattern, e.g. `teamId`. */
export function paramOf(route: AnyProxyRoute): string {
  const param = /:(\w+)/.exec(route.pattern)?.[1];
  if (param === undefined) {
    throw new Error(`no param in ${route.pattern}`);
  }
  return param;
}

/** The path the browser asks `request` at. */
export function proxyPath(request: DbbRequest): string {
  if (!isProxyRead(request)) {
    // unreachable: KorbjaegerData offers no read without a route
    throw new Error(`no proxy route for ${request.kind} yet`);
  }
  return pathOf(request.kind, request);
}

/** The read `route` names for its param's value; `undefined`: 404. */
export function proxyRouteRead(
  route: AnyProxyRoute,
  id: string | undefined
): DbbRequest | undefined {
  const dbbId = parseDbbId(id);
  return dbbId === undefined ? undefined : route.read(dbbId);
}

function isProxyRead(request: DbbRequest): request is ProxyRead<ProxyKind> {
  return Object.hasOwn(PROXY_ROUTES, request.kind);
}

function pathOf<K extends ProxyKind>(kind: K, request: ProxyRead<K>): string {
  const route: ProxyRoute<K> = PROXY_ROUTES[kind];
  return route.pattern.replace(`:${paramOf(route)}`, String(route.id(request)));
}
