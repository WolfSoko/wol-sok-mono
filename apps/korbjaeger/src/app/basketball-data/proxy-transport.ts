import {
  BasketballDataError,
  dbbWithoutPersons,
  dbbStatusOf,
  isBasketballDataError,
  type DbbRequestKind,
  type DbbTransport,
  type ReadSignal,
} from '@wolsok/feat-shared-basketball-data';
import { proxyUrl } from '../../shared/dbb-proxy-routes';
import type {
  LetzteAntwort,
  LetzteAntworten,
} from '@wolsok/feat-korbjaeger-antworten';
import { KeinInternetError } from './kein-internet-error';
import type { KorbReadOptions, Lesung } from './lesung';
import {
  browserOnline,
  HTTP_OK,
  PROXY_ZEITLIMIT_MS,
  reachProxy,
  readProxyJson,
  unavailableError,
  type ProxyCall,
  type ProxyFetch,
} from './proxy-fetch';
import type { StandGrund } from './stand';

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
 * The reads whose last good answer is kept: public DBB data, kept without
 * the persons a Spiel's match info names. Never a Spielbericht, whose Kader name children (ADR 0019),
 * nor the wizard's Liga search and Liga Teams, so browsing it evicts no
 * answer Meine Teams need offline.
 */
export const SPEICHERBARE_ARTEN: ReadonlySet<DbbRequestKind> = new Set([
  'team-games',
  'standings',
  'game-info',
  'club-games',
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
 * proxy path, without the persons in it (`dbbWithoutPersons`), once its `Lesung` (`KorbReadOptions`) says the read mapped
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
        { online, signal: options?.signal, zeitlimitMs },
        (body) => {
          const gespeichertAm = jetzt();
          lesung?.vormerken(() =>
            antworten.merken(path, request.kind, {
              antwort: dbbWithoutPersons(body),
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
  call: ProxyCall,
  gelesen: (body: unknown) => void
): Promise<unknown> {
  const response = await reachProxy(path, fetchProxy, call);
  switch (response.status) {
    case HTTP_OK: {
      const body = await readProxyJson(path, response);
      gelesen(body);
      return body;
    }
    case HTTP_NOT_FOUND:
      return dbbEnvelopeOrNotFound(path, response);
    default:
      throw unavailableError(path, `HTTP ${response.status}`);
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
