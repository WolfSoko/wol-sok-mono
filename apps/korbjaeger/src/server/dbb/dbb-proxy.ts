import {
  dbbHttpRequest,
  dbbStatusOf,
  type DbbHttpRequest,
  type DbbRequest,
} from '@wolsok/feat-shared-basketball-data';
import { defineEventHandler, getRouterParam } from 'h3';
import {
  badGateway,
  jsonResponse,
  notFound,
  sendProxyResponse,
  type ProxyResponse,
} from './dbb-proxy-response';
import type { DbbUpstream } from './dbb-upstream';
import { proxyRouteRead, type ProxyRoute } from '../../shared/dbb-proxy-routes';

/**
 * How long a successful read may be reused: a minute in the browser, five
 * minutes in Firebase Hosting's CDN (ADR 0018). Errors are never cached.
 */
export const DBB_PROXY_CACHE_CONTROL = 'public, max-age=60, s-maxage=300';

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
  switch (dbbStatusOf(parsedOrUndefined(answer.body))) {
    case 'ok':
      return jsonResponse(200, answer.body, {
        'cache-control': DBB_PROXY_CACHE_CONTROL,
      });
    case 'not-found':
      return jsonResponse(404, answer.body);
    case 'server-error':
      return failed(call, 'DBB status -1');
    default:
      return failed(call, 'no DBB envelope');
  }
}

/**
 * 502, with why in the function's logs: the call and the reason only,
 * never the DBB's body or anything of the visitor.
 */
function failed(call: DbbHttpRequest, reason: string): ProxyResponse {
  console.warn(`DBB proxy: ${call.method} ${call.path} failed: ${reason}`);
  return badGateway();
}

/** The handler of `route`'s file: its read, for the id its param names. */
export function proxyRouteHandler(route: ProxyRoute, upstream: DbbUpstream) {
  return defineEventHandler(async (event) =>
    sendProxyResponse(
      event,
      await proxyDbbRead(
        proxyRouteRead(route, getRouterParam(event, route.param)),
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
