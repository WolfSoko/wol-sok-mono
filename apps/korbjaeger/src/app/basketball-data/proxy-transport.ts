import {
  BasketballDataError,
  UnsupportedDbbRequestError,
  dbbStatusOf,
  type DbbRequest,
  type DbbTransport,
  type DbbTransportOptions,
} from '@wolsok/feat-shared-basketball-data';

/** The `fetch` the browser calls the app's proxy with; specs pass a fake. */
export type ProxyFetch = (url: string, init: RequestInit) => Promise<Response>;

const HTTP_OK = 200;
const HTTP_NOT_FOUND = 404;

/**
 * The path of the app's proxy route (`src/server/routes/api/dbb/`) that
 * answers `request`. A read without a route yet throws
 * `UnsupportedDbbRequestError`, which the adapter passes on as the bug it
 * is; a new kind of read does not compile until it is listed here.
 */
export function proxyPath(request: DbbRequest): string {
  switch (request.kind) {
    case 'team-spiele':
      return `/api/dbb/team/${request.teamId}/spiele`;
    case 'liga-suche':
    case 'liga-seite':
    case 'tabelle':
    case 'spielplan':
    case 'vereins-spiele':
    case 'spiel-info':
    case 'spielbericht':
      throw new UnsupportedDbbRequestError(request.kind);
    default:
      return unknownKind(request);
  }
}

/**
 * A `DbbTransport` over the app's own proxy, since the DBB sends no CORS
 * headers (ADR 0018). Hands the DBB envelope of a 200 or 404 to the
 * adapter, which reads its status; a 404 of the proxy itself (no such
 * read or id) is `not-found`; anything else (a 502, no network, no JSON)
 * is `unavailable`.
 */
export function proxyTransport(fetchProxy: ProxyFetch): DbbTransport {
  return async (request, options) => {
    const path = proxyPath(request);
    const response = await reach(path, fetchProxy, options);
    switch (response.status) {
      case HTTP_OK:
        return readJson(path, response);
      case HTTP_NOT_FOUND:
        return dbbEnvelopeOrNotFound(path, response);
      default:
        throw unavailable(path, `HTTP ${response.status}`);
    }
  };
}

async function reach(
  path: string,
  fetchProxy: ProxyFetch,
  { signal }: DbbTransportOptions = {}
): Promise<Response> {
  try {
    return await fetchProxy(path, {
      headers: { accept: 'application/json' },
      ...(signal ? { signal } : {}),
    });
  } catch (error) {
    throw unavailable(path, 'not reachable', error);
  }
}

async function readJson(path: string, response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch (error) {
    throw unavailable(path, 'no JSON', error);
  }
}

/** The DBB's not-found envelope, or the proxy's own 404 as `not-found`. */
async function dbbEnvelopeOrNotFound(
  path: string,
  response: Response
): Promise<unknown> {
  const body = await response.json().catch(() => undefined);
  if (dbbStatusOf(body) === undefined) {
    throw new BasketballDataError('not-found', `${path}: no such read or id`);
  }
  return body;
}

function unavailable(
  path: string,
  why: string,
  cause?: unknown
): BasketballDataError {
  return new BasketballDataError('unavailable', `${path}: ${why}`, { cause });
}

function unknownKind(request: never): never {
  throw new UnsupportedDbbRequestError((request as DbbRequest).kind);
}
