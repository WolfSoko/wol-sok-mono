import {
  BasketballDataError,
  type ReadSignal,
} from '@wolsok/feat-shared-basketball-data';
import { NoInternetError } from './no-internet-error';

/** The `fetch` the browser calls the app's server with; specs pass a fake. */
export type ProxyFetch = (url: string, init: RequestInit) => Promise<Response>;

/** The status of an answer the server gave as such. */
export const HTTP_OK = 200;

/**
 * How long a call to the proxy may take before it counts as unreachable:
 * `navigator.onLine` says nothing of a Halle's dead reception, where a
 * call would hang. Above the proxy's own 5 s for the DBB.
 */
export const PROXY_TIMEOUT_MS = 8_000;

/** How one call to the app's server goes. */
export interface ProxyCall {
  /** Whether the browser believes it is online (`navigator.onLine`). */
  readonly online: () => boolean;
  /** Cancels the call with the read it belongs to. */
  readonly signal: ReadSignal | undefined;
  /** How long the call may take; `PROXY_TIMEOUT_MS`. */
  readonly timeoutMs: number;
}

/**
 * The server's response at `path`, whatever its status. A device the
 * browser calls offline (`NoInternetError`, no call made), or a call the
 * server never answered within `timeoutMs`, is `offline` (no server
 * reached); one the read cancelled rejects as `fetch` did, so the caller
 * rejects with the read's reason.
 */
export async function reachProxy(
  path: string,
  fetchProxy: ProxyFetch,
  { online, signal, timeoutMs }: ProxyCall
): Promise<Response> {
  if (!online()) {
    throw new NoInternetError(path);
  }
  const abort = abortSignalOf(signal);
  try {
    return await fetchProxy(path, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.any([
        ...(abort === undefined ? [] : [abort]),
        AbortSignal.timeout(timeoutMs),
      ]),
    });
  } catch (error) {
    if (abort?.aborted) {
      throw error;
    }
    throw new BasketballDataError('offline', `${path}: proxy not reachable`, {
      cause: error,
    });
  }
}

/** The JSON body of `response`; one that is none is `unavailable`. */
export async function readProxyJson(
  path: string,
  response: Response
): Promise<unknown> {
  try {
    return await response.json();
  } catch (error) {
    throw unavailableError(path, 'no JSON', error);
  }
}

/** A call whose server answered, but not with what it was asked for. */
export function unavailableError(
  path: string,
  why: string,
  cause?: unknown
): BasketballDataError {
  return new BasketballDataError('unavailable', `${path}: ${why}`, { cause });
}

/** `navigator.onLine`; where there is no navigator, online. */
export function browserOnline(): boolean {
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
