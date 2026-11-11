import {
  defineEventHandler,
  setResponseHeaders,
  setResponseStatus,
  type H3Event,
} from 'h3';

/** What the proxy answers: status, headers and the body as sent. */
export interface ProxyResponse {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
}

const JSON_CONTENT_TYPE = 'application/json; charset=utf-8';

/**
 * What every error of the proxy is sent with: kept nowhere. Without a
 * `Cache-Control` of its own Firebase Hosting adds `max-age=600`, so a
 * browser would show a 404 or a DBB outage's 502 for ten minutes.
 */
export const PROXY_ERROR_CACHE_CONTROL = 'no-store';

/** A `Cache-Control` letting the browser keep an answer `browser` seconds, the CDN `cdn`. */
export function publicCacheControl(browser: number, cdn: number): string {
  return `public, max-age=${browser}, s-maxage=${cdn}`;
}

/** A JSON body as it is, a DBB body passed on or an error of the proxy. */
export function jsonResponse(
  status: number,
  body: string,
  headers: Readonly<Record<string, string>> = {}
): ProxyResponse {
  return {
    status,
    headers: { 'content-type': JSON_CONTENT_TYPE, ...headers },
    body,
  };
}

/** An error of the proxy or the DBB's, `body` as it is: never stored. */
export function errorResponse(status: number, body: string): ProxyResponse {
  return jsonResponse(status, body, {
    'cache-control': PROXY_ERROR_CACHE_CONTROL,
  });
}

/** No such read, or no such id: 404 with a short JSON error. */
export function notFound(): ProxyResponse {
  return errorResponse(404, JSON.stringify({ error: 'not-found' }));
}

/** The DBB failed or was not reached: 502 with a short JSON error. */
export function badGateway(): ProxyResponse {
  return errorResponse(502, JSON.stringify({ error: 'dbb-unavailable' }));
}

/** Writes `response` to `event`: only its own headers, never the DBB's. */
export function sendProxyResponse(
  event: H3Event,
  response: ProxyResponse
): string {
  setResponseStatus(event, response.status);
  setResponseHeaders(event, response.headers);
  return response.body;
}

/** Every path under `/api/dbb/` that is no allowlisted read. */
export const unknownDbbPathHandler = defineEventHandler((event) =>
  sendProxyResponse(event, notFound())
);
