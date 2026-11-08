import {
  dbbBoxscoreFinished,
  dbbHttpRequest,
  dbbStatusOf,
  type DbbHttpRequest,
  type DbbRequest,
} from '@wolsok/feat-shared-basketball-data';
import { defineEventHandler, getRequestURL, getRouterParams } from 'h3';
import {
  badGateway,
  jsonResponse,
  notFound,
  sendProxyResponse,
  type ProxyResponse,
} from './dbb-proxy-response';
import type { DbbUpstream } from './dbb-upstream';
import type { AnyProxyRoute } from '../../shared/dbb-proxy-routes';

/**
 * How long a successful read may be reused: a minute in the browser, five
 * minutes in Firebase Hosting's CDN (ADR 0018). Errors are never cached.
 */
export const DBB_PROXY_CACHE_CONTROL = 'public, max-age=60, s-maxage=300';

/**
 * How long the CDN may keep a played Spiel's Spielbericht: an hour, since
 * the DBB rarely changes it once its result and Kader are in (ADR 0018).
 * The browser keeps it a minute, as every read.
 */
export const FINISHED_BOXSCORE_CACHE_CONTROL =
  'public, max-age=60, s-maxage=3600';

/**
 * Answers one allowlisted read (`undefined`: none, so 404) from the DBB:
 * its body unchanged, with the HTTP status its envelope's `status` stands
 * for.
 */
export async function proxyDbbRead(
  request: DbbRequest | undefined,
  upstream: DbbUpstream
): Promise<ProxyResponse> {
  if (request === undefined) {
    return notFound();
  }
  const call = dbbHttpRequest(request);
  const answer = await upstream(call);
  if (!answer.ok) {
    return failed(call, answer.reason);
  }
  const body = parsedOrUndefined(answer.body);
  switch (dbbStatusOf(body)) {
    case 'ok':
      return jsonResponse(200, answer.body, {
        'cache-control': cacheControlOf(request, body),
      });
    case 'not-found':
      return jsonResponse(404, answer.body);
    case 'server-error':
      return failed(call, 'DBB status -1');
    default:
      return failed(call, 'no DBB envelope');
  }
}

/** How long a success may be reused: a played Spiel's Spielbericht longer. */
function cacheControlOf(request: DbbRequest, body: unknown): string {
  return request.kind === 'spielbericht' && dbbBoxscoreFinished(body)
    ? FINISHED_BOXSCORE_CACHE_CONTROL
    : DBB_PROXY_CACHE_CONTROL;
}

/**
 * 502, with why in the function's logs: the call and the reason only,
 * never the DBB's body or anything of the visitor.
 */
function failed(call: DbbHttpRequest, reason: string): ProxyResponse {
  console.warn(`DBB proxy: ${call.method} ${call.path} failed: ${reason}`);
  return badGateway();
}

/**
 * `route`'s handler over `upstream`: its read, for the params and query
 * the request carries.
 */
export function proxyRouteHandler(route: AnyProxyRoute, upstream: DbbUpstream) {
  return defineEventHandler(async (event) =>
    sendProxyResponse(
      event,
      await proxyDbbRead(
        route.readOf({
          params: getRouterParams(event),
          query: getRequestURL(event).searchParams,
        }),
        upstream
      )
    )
  );
}

function parsedOrUndefined(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
}
