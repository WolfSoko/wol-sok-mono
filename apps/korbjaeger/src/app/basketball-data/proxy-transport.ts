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
  CachedAnswer,
  AnswerCache,
} from '@wolsok/feat-korbjaeger-answers';
import { NoInternetError } from './no-internet-error';
import type { KorbReadOptions, Reading } from './reading';
import {
  browserOnline,
  HTTP_OK,
  PROXY_TIMEOUT_MS,
  reachProxy,
  readProxyJson,
  unavailableError,
  type ProxyCall,
  type ProxyFetch,
} from './proxy-fetch';
import type { AsOfReason } from './as-of';

const HTTP_NOT_FOUND = 404;

/** What the transport asks of the browser beside `fetch`; specs pass fakes. */
export interface ProxyTransportOptions {
  /** Whether the browser believes it is online (`navigator.onLine`). */
  readonly online?: () => boolean;
  /** Where the last good answer of each path is kept; none by default. */
  readonly answers?: AnswerCache;
  /** The time an answer is stored with, in ms since the epoch. */
  readonly now?: () => number;
  /** How long a call to the proxy may take; `PROXY_TIMEOUT_MS`. */
  readonly timeoutMs?: number;
}

/**
 * The reads whose last good answer is kept: public DBB data, kept without
 * the persons a Spiel's match info names. Never a Spielbericht, whose Kader name children (ADR 0019),
 * nor the wizard's Liga search and Liga Teams, so browsing it evicts no
 * answer Meine Teams need offline.
 */
export const STORABLE_KINDS: ReadonlySet<DbbRequestKind> = new Set([
  'team-games',
  'standings',
  'game-info',
  'club-games',
]);

/** Keeps nothing: a read that fails has no answer to fall back on. */
const NO_ANSWERS: AnswerCache = {
  read: () => undefined,
  store: () => undefined,
};

/**
 * A `DbbTransport` over the app's own proxy, since the DBB sends no CORS
 * headers (ADR 0018). Hands the DBB envelope of a 200 or 404 to the
 * adapter, which reads its status; a 404 of the proxy itself (no such
 * read or id) is `not-found`. A device the browser calls offline
 * (`NoInternetError`), or a call that reaches no proxy within
 * `PROXY_TIMEOUT_MS`, is `offline`; anything else (a 502, no JSON) is
 * `unavailable`.
 *
 * The 200 of a read of `STORABLE_KINDS` is kept in `answers` by its
 * proxy path, without the persons in it (`dbbWithoutPersons`), once its `Reading` (`KorbReadOptions`) says the read mapped
 * it. A read with a `Reading` that then fails as `offline` or
 * `unavailable` is answered from it instead, and the `Reading` hears when
 * it came and why; a 404 (the thing is gone) and a cancelled read never
 * are.
 */
export function proxyTransport(
  fetchProxy: ProxyFetch,
  {
    online = browserOnline,
    answers = NO_ANSWERS,
    now = Date.now,
    timeoutMs = PROXY_TIMEOUT_MS,
  }: ProxyTransportOptions = {}
): DbbTransport<KorbReadOptions> {
  return async (request, options) => {
    const path = proxyUrl(request);
    const reading = STORABLE_KINDS.has(request.kind)
      ? options?.reading
      : undefined;
    try {
      return await readProxy(
        path,
        fetchProxy,
        { online, signal: options?.signal, timeoutMs },
        (body) => {
          const storedAt = now();
          reading?.defer(() =>
            answers.store(path, request.kind, {
              answer: dbbWithoutPersons(body),
              storedAt,
            })
          );
        }
      );
    } catch (error) {
      if (reading === undefined) {
        throw error;
      }
      return cachedAnswerInstead(
        error,
        answers.read(path, now()),
        reading,
        options?.signal
      );
    }
  };
}

/**
 * `last`'s answer for a read that failed with `error`, where it may take
 * one (telling its `reading`); else throws `error`.
 */
function cachedAnswerInstead(
  error: unknown,
  last: CachedAnswer | undefined,
  reading: Reading,
  signal: ReadSignal | undefined
): unknown {
  if (last === undefined || !replaceable(error, signal)) {
    throw error;
  }
  reading.replaced({
    storedAt: last.storedAt,
    reason: asOfReasonOf(error),
  });
  return last.answer;
}

/**
 * The proxy's answer at `path`: the body of a 200 (handed to `read`)
 * or a 404's DBB envelope; throws a `BasketballDataError` for the rest.
 */
async function readProxy(
  path: string,
  fetchProxy: ProxyFetch,
  call: ProxyCall,
  read: (body: unknown) => void
): Promise<unknown> {
  const response = await reachProxy(path, fetchProxy, call);
  switch (response.status) {
    case HTTP_OK: {
      const body = await readProxyJson(path, response);
      read(body);
      return body;
    }
    case HTTP_NOT_FOUND:
      return dbbEnvelopeOrNotFound(path, response);
    default:
      throw unavailableError(path, `HTTP ${response.status}`);
  }
}

/** Whether a read that failed with `error` may take its last good answer. */
function replaceable(
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
function asOfReasonOf(error: BasketballDataError): AsOfReason {
  if (error instanceof NoInternetError) {
    return 'no-internet';
  }
  return error.kind === 'offline' ? 'no-connection' : 'unavailable';
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
