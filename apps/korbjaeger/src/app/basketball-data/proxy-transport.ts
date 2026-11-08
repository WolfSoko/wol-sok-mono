import {
  BasketballDataError,
  type DbbRequest,
  type DbbTransport,
} from '@wolsok/feat-shared-basketball-data';

/** The `fetch` the browser calls the app's proxy with; specs pass a fake. */
export type ProxyFetch = (url: string, init: RequestInit) => Promise<Response>;

/** The statuses whose body is a DBB envelope for the adapter to read. */
const ENVELOPE_STATUSES: ReadonlySet<number> = new Set([200, 404]);

/**
 * The path of the app's proxy route (`src/server/routes/api/dbb/`) that
 * answers `request`. Throws for a read that has no route yet.
 */
export function proxyPath(request: DbbRequest): string {
  switch (request.kind) {
    case 'team-spiele':
      return `/api/dbb/team/${request.teamId}/spiele`;
    default:
      throw new Error(`no proxy route for ${request.kind} yet`);
  }
}

/**
 * A `DbbTransport` over the app's own proxy, since the DBB sends no CORS
 * headers (ADR 0018). Hands the DBB body of a 200 or 404 to the adapter,
 * which reads its envelope; anything else (a 502, no network, no JSON) is
 * `unavailable`.
 */
export function proxyTransport(fetchProxy: ProxyFetch): DbbTransport {
  return async (request) => {
    const path = proxyPath(request);
    const response = await reach(path, fetchProxy);
    if (!ENVELOPE_STATUSES.has(response.status)) {
      throw unavailable(path, `HTTP ${response.status}`);
    }
    try {
      return await response.json();
    } catch (error) {
      throw unavailable(path, 'no JSON', error);
    }
  };
}

async function reach(path: string, fetchProxy: ProxyFetch): Promise<Response> {
  try {
    return await fetchProxy(path, { headers: { accept: 'application/json' } });
  } catch (error) {
    throw unavailable(path, 'not reachable', error);
  }
}

function unavailable(
  path: string,
  why: string,
  cause?: unknown
): BasketballDataError {
  return new BasketballDataError('unavailable', `${path}: ${why}`, { cause });
}
