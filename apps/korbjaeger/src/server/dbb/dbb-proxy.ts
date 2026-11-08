import {
  dbbHttpRequest,
  dbbStatusOf,
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
import { teamSpieleRequest } from './proxy-requests';

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
  const answer = await upstream(dbbHttpRequest(request));
  if (!answer.ok) {
    return badGateway();
  }
  switch (dbbStatusOf(parsedOrUndefined(answer.body))) {
    case 'ok':
      return jsonResponse(200, answer.body, {
        'cache-control': DBB_PROXY_CACHE_CONTROL,
      });
    case 'not-found':
      return jsonResponse(404, answer.body);
    default:
      return badGateway();
  }
}

/** `GET /api/dbb/team/{teamId}/spiele`: a Team's Spiele of the Saison. */
export function teamSpieleHandler(upstream: DbbUpstream) {
  return defineEventHandler(async (event) =>
    sendProxyResponse(
      event,
      await proxyDbbRead(
        teamSpieleRequest(getRouterParam(event, 'teamId')),
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
