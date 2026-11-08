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

/** A DBB body, passed on as it came. */
export function dbbBody(
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

/** No such read, or no such id: 404 with a short JSON error, not cached. */
export function notFound(): ProxyResponse {
  return dbbBody(404, JSON.stringify({ error: 'not-found' }));
}

/** The DBB failed or was not reached: 502 with a short JSON error. */
export function badGateway(): ProxyResponse {
  return dbbBody(502, JSON.stringify({ error: 'dbb-unavailable' }));
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
