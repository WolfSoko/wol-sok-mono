import {
  BasketballDataError,
  dbbStatusOf,
  isBasketballDataError,
  type DbbTransport,
  type ReadOptions,
  type ReadSignal,
} from '@wolsok/feat-shared-basketball-data';
import { proxyUrl } from '../../shared/dbb-proxy-routes';
import type { LetzteAntwort, LetzteAntworten } from './letzte-antworten';
import { beiStandVon, type StandGrund } from './stand';

/** The `fetch` the browser calls the app's proxy with; specs pass a fake. */
export type ProxyFetch = (url: string, init: RequestInit) => Promise<Response>;

const HTTP_OK = 200;
const HTTP_NOT_FOUND = 404;

/** What the transport asks of the browser beside `fetch`; specs pass fakes. */
export interface ProxyTransportOptions {
  /** Whether the browser believes it is online (`navigator.onLine`). */
  readonly online?: () => boolean;
  /** Where the last good answer of each path is kept; none by default. */
  readonly antworten?: LetzteAntworten;
  /** The time an answer is stored with, in ms since the epoch. */
  readonly jetzt?: () => number;
}

/** Keeps nothing: a read that fails has no answer to fall back on. */
const KEINE_ANTWORTEN: LetzteAntworten = {
  lesen: () => undefined,
  merken: () => undefined,
};

/**
 * A `DbbTransport` over the app's own proxy, since the DBB sends no CORS
 * headers (ADR 0018). Hands the DBB envelope of a 200 or 404 to the
 * adapter, which reads its status; a 404 of the proxy itself (no such
 * read or id) is `not-found`. A device the browser calls offline, or a
 * call that never reaches the proxy, is `offline`; anything else (a 502,
 * no JSON) is `unavailable`.
 *
 * Each 200 is kept in `antworten` by its proxy path. A read that then
 * fails as `offline` or `unavailable` is answered from it instead, and
 * its options' `beiStand` (`StandReadOptions`) hears when it came and
 * why; a 404 (the thing is gone) and a cancelled read never are.
 */
export function proxyTransport(
  fetchProxy: ProxyFetch,
  {
    online = browserOnline,
    antworten = KEINE_ANTWORTEN,
    jetzt = Date.now,
  }: ProxyTransportOptions = {}
): DbbTransport {
  return async (request, options) => {
    const path = proxyUrl(request);
    try {
      return await readProxy(
        path,
        fetchProxy,
        online,
        options?.signal,
        (body) =>
          antworten.merken(path, { antwort: body, gespeichertAm: jetzt() })
      );
    } catch (error) {
      return letzteAntwortStatt(error, antworten.lesen(path), options);
    }
  };
}

/**
 * `letzte`'s answer for a read that failed with `error`, where it may take
 * one (telling its `beiStand`); else throws `error`.
 */
function letzteAntwortStatt(
  error: unknown,
  letzte: LetzteAntwort | undefined,
  options: ReadOptions | undefined
): unknown {
  if (letzte === undefined || !ersetzbar(error, options?.signal)) {
    throw error;
  }
  beiStandVon(options)?.({
    gespeichertAm: letzte.gespeichertAm,
    grund: error.kind,
  });
  return letzte.antwort;
}

/**
 * The proxy's answer at `path`: the body of a 200 (handed to `gelesen`)
 * or a 404's DBB envelope; throws a `BasketballDataError` for the rest.
 */
async function readProxy(
  path: string,
  fetchProxy: ProxyFetch,
  online: () => boolean,
  signal: ReadSignal | undefined,
  gelesen: (body: unknown) => void
): Promise<unknown> {
  if (!online()) {
    throw offline(path, 'the browser is offline');
  }
  const response = await reach(path, fetchProxy, signal);
  switch (response.status) {
    case HTTP_OK: {
      const body = await readJson(path, response);
      gelesen(body);
      return body;
    }
    case HTTP_NOT_FOUND:
      return dbbEnvelopeOrNotFound(path, response);
    default:
      throw unavailable(path, `HTTP ${response.status}`);
  }
}

/** Whether a read that failed with `error` may take its last good answer. */
function ersetzbar(
  error: unknown,
  signal: ReadSignal | undefined
): error is BasketballDataError & { readonly kind: StandGrund } {
  return (
    signal?.aborted !== true &&
    (isBasketballDataError(error, 'offline') ||
      isBasketballDataError(error, 'unavailable'))
  );
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
