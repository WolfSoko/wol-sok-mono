import {
  BasketballDataError,
  dbbOhnePersonen,
  dbbStatusOf,
  isBasketballDataError,
  type DbbRequestKind,
  type DbbTransport,
  type ReadSignal,
} from '@wolsok/feat-shared-basketball-data';
import { proxyUrl } from '../../shared/dbb-proxy-routes';
import type { LetzteAntwort, LetzteAntworten } from './letzte-antworten';
import { KeinInternetError } from './kein-internet-error';
import type { KorbReadOptions, Lesung } from './lesung';
import type { StandGrund } from './stand';

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
  /** How long a call to the proxy may take; `PROXY_ZEITLIMIT_MS`. */
  readonly zeitlimitMs?: number;
}

/**
 * How long a call to the proxy may take before it counts as unreachable:
 * `navigator.onLine` says nothing of a Halle's dead reception, where a
 * call would hang. Above the proxy's own 5 s for the DBB.
 */
export const PROXY_ZEITLIMIT_MS = 8_000;

/**
 * The reads whose last good answer is kept: public DBB data, kept without
 * the persons a Spiel's match info names. Never a Spielbericht, whose Kader name children (ADR 0019),
 * nor the wizard's Liga search and Liga Teams, so browsing it evicts no
 * answer Meine Teams need offline.
 */
export const SPEICHERBARE_ARTEN: ReadonlySet<DbbRequestKind> = new Set([
  'team-spiele',
  'tabelle',
  'spiel-info',
  'vereins-spiele',
]);

/** Keeps nothing: a read that fails has no answer to fall back on. */
const KEINE_ANTWORTEN: LetzteAntworten = {
  lesen: () => undefined,
  merken: () => undefined,
};

/**
 * A `DbbTransport` over the app's own proxy, since the DBB sends no CORS
 * headers (ADR 0018). Hands the DBB envelope of a 200 or 404 to the
 * adapter, which reads its status; a 404 of the proxy itself (no such
 * read or id) is `not-found`. A device the browser calls offline
 * (`KeinInternetError`), or a call that reaches no proxy within
 * `PROXY_ZEITLIMIT_MS`, is `offline`; anything else (a 502, no JSON) is
 * `unavailable`.
 *
 * The 200 of a read of `SPEICHERBARE_ARTEN` is kept in `antworten` by its
 * proxy path, without the persons in it (`dbbOhnePersonen`), once its `Lesung` (`KorbReadOptions`) says the read mapped
 * it. A read with a `Lesung` that then fails as `offline` or
 * `unavailable` is answered from it instead, and the `Lesung` hears when
 * it came and why; a 404 (the thing is gone) and a cancelled read never
 * are.
 */
export function proxyTransport(
  fetchProxy: ProxyFetch,
  {
    online = browserOnline,
    antworten = KEINE_ANTWORTEN,
    jetzt = Date.now,
    zeitlimitMs = PROXY_ZEITLIMIT_MS,
  }: ProxyTransportOptions = {}
): DbbTransport<KorbReadOptions> {
  return async (request, options) => {
    const path = proxyUrl(request);
    const lesung = SPEICHERBARE_ARTEN.has(request.kind)
      ? options?.lesung
      : undefined;
    try {
      return await readProxy(
        path,
        fetchProxy,
        online,
        { signal: options?.signal, zeitlimitMs },
        (body) => {
          const gespeichertAm = jetzt();
          lesung?.vormerken(() =>
            antworten.merken(path, request.kind, {
              antwort: dbbOhnePersonen(body),
              gespeichertAm,
            })
          );
        }
      );
    } catch (error) {
      if (lesung === undefined) {
        throw error;
      }
      return letzteAntwortStatt(
        error,
        antworten.lesen(path, jetzt()),
        lesung,
        options?.signal
      );
    }
  };
}

/**
 * `letzte`'s answer for a read that failed with `error`, where it may take
 * one (telling its `lesung`); else throws `error`.
 */
function letzteAntwortStatt(
  error: unknown,
  letzte: LetzteAntwort | undefined,
  lesung: Lesung,
  signal: ReadSignal | undefined
): unknown {
  if (letzte === undefined || !ersetzbar(error, signal)) {
    throw error;
  }
  lesung.ersetzt({
    gespeichertAm: letzte.gespeichertAm,
    grund: standGrundVon(error),
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
  aufruf: Aufruf,
  gelesen: (body: unknown) => void
): Promise<unknown> {
  if (!online()) {
    throw new KeinInternetError(path);
  }
  const response = await reach(path, fetchProxy, aufruf);
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
): error is BasketballDataError {
  return (
    signal?.aborted !== true &&
    (isBasketballDataError(error, 'offline') ||
      isBasketballDataError(error, 'unavailable'))
  );
}

/** Why a read that failed with `error` took its last good answer. */
function standGrundVon(error: BasketballDataError): StandGrund {
  if (error instanceof KeinInternetError) {
    return 'kein-internet';
  }
  return error.kind === 'offline' ? 'keine-verbindung' : 'unavailable';
}

/** How one call to the proxy goes: cancelled with the read, or timed out. */
interface Aufruf {
  readonly signal: ReadSignal | undefined;
  readonly zeitlimitMs: number;
}

/**
 * The proxy's response. A call it never answered, or not within
 * `zeitlimitMs`, is `offline` (no server reached); one the read cancelled
 * rejects as `fetch` did, and the adapter rejects with the read's reason.
 */
async function reach(
  path: string,
  fetchProxy: ProxyFetch,
  { signal, zeitlimitMs }: Aufruf
): Promise<Response> {
  const abbruch = abortSignalOf(signal);
  try {
    return await fetchProxy(path, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.any([
        ...(abbruch === undefined ? [] : [abbruch]),
        AbortSignal.timeout(zeitlimitMs),
      ]),
    });
  } catch (error) {
    if (abbruch?.aborted) {
      throw error;
    }
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
