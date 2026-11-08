import {
  assertValidDbbRequest,
  parseDbbId,
  type DbbRequest,
  type LigaSucheFilter,
} from '@wolsok/feat-shared-basketball-data';

/** The reads the app's proxy has a route for. */
export type ProxyKind =
  | 'liga-suche'
  | 'liga-seite'
  | 'spielplan'
  | 'team-spiele'
  | 'tabelle'
  | 'spiel-info'
  | 'spielbericht';

/** The read of kind `K`. */
export type ProxyRead<K extends ProxyKind> = Extract<DbbRequest, { kind: K }>;

/** What a request at a route carries: its path params and its query. */
export interface ProxyRouteInput {
  readonly params: Readonly<Partial<Record<string, string>>>;
  readonly query: URLSearchParams;
}

/** What a route file and the proxy need of any route. */
export interface AnyProxyRoute {
  /** The path as h3 and Nitro route it, an id as `:param`. */
  readonly pattern: string;
  /** The read a request at the route names; `undefined`: none, so 404. */
  readonly readOf: (input: ProxyRouteInput) => DbbRequest | undefined;
}

/**
 * One of the app's proxy routes (`src/server/routes/api/dbb/`): a read by
 * a numeric id in the path, or by a filter in the query. Its route file
 * lies at its pattern, a param as folder (`team/[teamId]/spiele.get.ts`).
 */
export interface ProxyRoute<K extends ProxyKind> extends AnyProxyRoute {
  readonly readOf: (input: ProxyRouteInput) => ProxyRead<K> | undefined;
  /** The URL, path and query, the browser asks `read` at. */
  readonly urlOf: (read: ProxyRead<K>) => string;
}

/** The query parameters of the Liga search, one per filter list. */
const FILTER_PARAMS = {
  verband: 'verband',
  altersklasse: 'altersklasse',
  geschlecht: 'geschlecht',
} as const;

/** The query parameter of a later page's start index. */
const START_PARAM = 'start';

const DIGITS = /^\d+$/;

/**
 * Every proxy route, by the kind of read it serves: the one place that
 * names a route. A read gets its entry here, its route file and its place
 * in `KorbjaegerData`.
 */
export const PROXY_ROUTES: { readonly [K in ProxyKind]: ProxyRoute<K> } = {
  'liga-suche': {
    pattern: '/api/dbb/ligen',
    readOf: ({ query }) => {
      const filter = filterOf(query, []);
      return filter === undefined
        ? undefined
        : validOrUndefined({ kind: 'liga-suche', filter });
    },
    urlOf: ({ filter }) => withQuery('/api/dbb/ligen', filterQuery(filter)),
  },
  'liga-seite': {
    pattern: '/api/dbb/ligen/seite',
    readOf: ({ query }) => {
      const filter = filterOf(query, [START_PARAM]);
      const startIndex = startIndexOf(query);
      return filter === undefined || startIndex === undefined
        ? undefined
        : validOrUndefined({ kind: 'liga-seite', filter, startIndex });
    },
    urlOf: ({ filter, startIndex }) =>
      withQuery(
        '/api/dbb/ligen/seite',
        new URLSearchParams([
          [START_PARAM, String(startIndex)],
          ...filterQuery(filter),
        ])
      ),
  },
  spielplan: idRoute(
    '/api/dbb/liga/:ligaId/spielplan',
    (ligaId) => ({ kind: 'spielplan', ligaId }),
    ({ ligaId }) => ligaId
  ),
  'team-spiele': idRoute(
    '/api/dbb/team/:teamId/spiele',
    (teamId) => ({ kind: 'team-spiele', teamId }),
    ({ teamId }) => teamId
  ),
  tabelle: idRoute(
    '/api/dbb/liga/:ligaId/tabelle',
    (ligaId) => ({ kind: 'tabelle', ligaId }),
    ({ ligaId }) => ligaId
  ),
  'spiel-info': idRoute(
    '/api/dbb/spiel/:spielId',
    (spielId) => ({ kind: 'spiel-info', spielId }),
    ({ spielId }) => spielId
  ),
  spielbericht: idRoute(
    '/api/dbb/spiel/:spielId/bericht',
    (spielId) => ({ kind: 'spielbericht', spielId }),
    ({ spielId }) => spielId
  ),
};

/** The URL, path and query, the browser asks `request` at. */
export function proxyUrl(request: DbbRequest): string {
  if (!isProxyRead(request)) {
    // unreachable: KorbjaegerData offers no read without a route
    throw new Error(`no proxy route for ${request.kind} yet`);
  }
  return urlOf(request.kind, request);
}

/**
 * A route reading by the one numeric id its pattern names as `:param`,
 * and nothing else: a request with any query names no read.
 */
function idRoute<K extends ProxyKind>(
  pattern: string,
  read: (id: number) => ProxyRead<K>,
  id: (read: ProxyRead<K>) => number
): ProxyRoute<K> {
  const param = /:(\w+)/.exec(pattern)?.[1];
  if (param === undefined) {
    throw new Error(`no param in ${pattern}`);
  }
  return {
    pattern,
    readOf: ({ params, query }) => {
      // no query either: each new one would be a cache miss for the DBB
      const dbbId = query.size === 0 ? parseDbbId(params[param]) : undefined;
      return dbbId === undefined ? undefined : read(dbbId);
    },
    urlOf: (request) => pattern.replace(`:${param}`, String(id(request))),
  };
}

/**
 * The Liga search filter `query` names; `undefined` for a parameter it
 * does not know (beside `extra`) or an id that is no number. The age
 * group and gender ids are checked with the read (`validOrUndefined`).
 */
function filterOf(
  query: URLSearchParams,
  extra: readonly string[]
): LigaSucheFilter | undefined {
  const known = new Set<string>([...Object.values(FILTER_PARAMS), ...extra]);
  if ([...query.keys()].some((key) => !known.has(key))) {
    return undefined;
  }
  const verbandIds = dbbIdsOf(query.getAll(FILTER_PARAMS.verband));
  const altersklasseIds = dbbIdsOf(query.getAll(FILTER_PARAMS.altersklasse));
  if (verbandIds === undefined || altersklasseIds === undefined) {
    return undefined;
  }
  return {
    verbandIds,
    altersklasseIds,
    altersgruppeGeschlechtIds: query.getAll(FILTER_PARAMS.geschlecht),
  };
}

/** The ids `texts` name, or `undefined` if one names none. */
function dbbIdsOf(texts: readonly string[]): readonly number[] | undefined {
  const ids = texts.map(parseDbbId);
  return ids.every((id) => id !== undefined) ? ids : undefined;
}

/** The one start index `query` names, digits only; else `undefined`. */
function startIndexOf(query: URLSearchParams): number | undefined {
  const texts = query.getAll(START_PARAM);
  if (texts.length !== 1 || !DIGITS.test(texts[0])) {
    return undefined;
  }
  return Number(texts[0]);
}

/** `request`, if the DBB can take it (`assertValidDbbRequest`). */
function validOrUndefined<R extends DbbRequest>(request: R): R | undefined {
  try {
    assertValidDbbRequest(request);
    return request;
  } catch {
    return undefined;
  }
}

function filterQuery(filter: LigaSucheFilter): URLSearchParams {
  return new URLSearchParams([
    ...filter.verbandIds.map((id) => [FILTER_PARAMS.verband, String(id)]),
    ...filter.altersklasseIds.map((id) => [
      FILTER_PARAMS.altersklasse,
      String(id),
    ]),
    ...filter.altersgruppeGeschlechtIds.map((id) => [
      FILTER_PARAMS.geschlecht,
      id,
    ]),
  ]);
}

function withQuery(path: string, query: URLSearchParams): string {
  const text = query.toString();
  return text === '' ? path : `${path}?${text}`;
}

function isProxyRead(request: DbbRequest): request is ProxyRead<ProxyKind> {
  return Object.hasOwn(PROXY_ROUTES, request.kind);
}

function urlOf<K extends ProxyKind>(kind: K, request: ProxyRead<K>): string {
  const route: ProxyRoute<K> = PROXY_ROUTES[kind];
  return route.urlOf(request);
}
