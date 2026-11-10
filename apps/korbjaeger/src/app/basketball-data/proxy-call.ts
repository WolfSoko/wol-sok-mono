import {
  BasketballDataError,
  type ReadSignal,
} from '@wolsok/feat-shared-basketball-data';
import { KeinInternetError } from './kein-internet-error';

/**
 * The `fetch` the browser calls the app's own server routes with (the DBB
 * proxy, the club index); specs pass a fake.
 */
export type ProxyFetch = (url: string, init: RequestInit) => Promise<Response>;

/**
 * How long a call to the proxy may take before it counts as unreachable:
 * `navigator.onLine` says nothing of a Halle's dead reception, where a
 * call would hang. Above the proxy's own 5 s for the DBB.
 */
export const PROXY_ZEITLIMIT_MS = 8_000;

/** How one call to the proxy goes: cancelled with the read, or timed out. */
export interface ProxyCall {
  readonly signal: ReadSignal | undefined;
  readonly zeitlimitMs: number;
}

/**
 * The proxy's response at `path`, where the browser believes it is online
 * (else `KeinInternetError`); see `reach`.
 */
export async function callProxy(
  path: string,
  fetchProxy: ProxyFetch,
  online: () => boolean,
  call: ProxyCall
): Promise<Response> {
  if (!online()) {
    throw new KeinInternetError(path);
  }
  return reach(path, fetchProxy, call);
}

/**
 * The proxy's response. A call it never answered, or not within
 * `zeitlimitMs`, is `offline` (no server reached); one the read cancelled
 * rejects as `fetch` did, and the adapter rejects with the read's reason.
 */
async function reach(
  path: string,
  fetchProxy: ProxyFetch,
  { signal, zeitlimitMs }: ProxyCall
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

/** The JSON body of `response`; one without is `unavailable`. */
export async function readJson(path: string, response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch (error) {
    throw unavailable(path, 'no JSON', error);
  }
}

function offline(
  path: string,
  why: string,
  cause?: unknown
): BasketballDataError {
  return new BasketballDataError('offline', `${path}: ${why}`, { cause });
}

/** A call the server answered, but not as asked. */
export function unavailable(
  path: string,
  why: string,
  cause?: unknown
): BasketballDataError {
  return new BasketballDataError('unavailable', `${path}: ${why}`, { cause });
}
