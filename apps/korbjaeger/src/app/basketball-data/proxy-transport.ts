import {
  BasketballDataError,
  dbbStatusOf,
  type DbbTransport,
  type ReadSignal,
} from '@wolsok/feat-shared-basketball-data';
import { proxyUrl } from '../../shared/dbb-proxy-routes';

/** The `fetch` the browser calls the app's proxy with; specs pass a fake. */
export type ProxyFetch = (url: string, init: RequestInit) => Promise<Response>;

const HTTP_OK = 200;
const HTTP_NOT_FOUND = 404;

/** What the transport asks of the browser beside `fetch`; specs pass fakes. */
export interface ProxyTransportOptions {
  /** Whether the browser believes it is online (`navigator.onLine`). */
  readonly online?: () => boolean;
}

/**
 * A `DbbTransport` over the app's own proxy, since the DBB sends no CORS
 * headers (ADR 0018). Hands the DBB envelope of a 200 or 404 to the
 * adapter, which reads its status; a 404 of the proxy itself (no such
 * read or id) is `not-found`. A device the browser calls offline, or a
 * call that never reaches the proxy, is `offline`; anything else (a 502,
 * no JSON) is `unavailable`.
 */
export function proxyTransport(
  fetchProxy: ProxyFetch,
  { online = browserOnline }: ProxyTransportOptions = {}
): DbbTransport {
  return async (request, options) => {
    const path = proxyUrl(request);
    if (!online()) {
      throw offline(path, 'the browser is offline');
    }
    const response = await reach(path, fetchProxy, options?.signal);
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
  signal: ReadSignal | undefined
): Promise<Response> {
  try {
    return await fetchProxy(path, {
      headers: { accept: 'application/json' },
      signal: abortSignalOf(signal),
    });
  } catch (error) {
    throw offline(path, 'proxy not reachable', error);
  }
}

/** `navigator.onLine`; where there is no navigator, online. */
function browserOnline(): boolean {
  return globalThis.navigator?.onLine !== false;
}

/** `fetch`'s own `AbortSignal` for a read's signal. */
function abortSignalOf(
  signal: ReadSignal | undefined
): AbortSignal | undefined {
  if (signal === undefined || signal instanceof AbortSignal) {
    return signal;
  }
  const controller = new AbortController();
  signal.addEventListener('abort', () => controller.abort(signal.reason), {
    once: true,
  });
  if (signal.aborted) {
    controller.abort(signal.reason);
  }
  return controller.signal;
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

function offline(
  path: string,
  why: string,
  cause?: unknown
): BasketballDataError {
  return new BasketballDataError('offline', `${path}: ${why}`, { cause });
}

function unavailable(
  path: string,
  why: string,
  cause?: unknown
): BasketballDataError {
  return new BasketballDataError('unavailable', `${path}: ${why}`, { cause });
}
