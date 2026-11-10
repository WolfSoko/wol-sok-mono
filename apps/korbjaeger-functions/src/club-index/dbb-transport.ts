import {
  dbbFetchInput,
  dbbHttpRequest,
  type DbbTransport,
} from '@wolsok/feat-shared-basketball-data';

/** How the club index calls the DBB. */
export interface DirectDbbOptions {
  /** The DBB's API, `DbbHttpRequest.path` is relative to it. */
  readonly baseUrl: string;
  readonly fetch: (url: string, init: RequestInit) => Promise<Response>;
  /** How long a call, body included, may take before it fails. */
  readonly timeoutMs: number;
  readonly userAgent: string;
}

/**
 * Calls the DBB directly, as the app's proxy does (ADR 0018): only the
 * allowlisted reads, its own User-Agent, no cookies, within `timeoutMs`.
 * Any status but 200 throws, which the adapter counts as `unavailable`.
 */
export function directDbbTransport(options: DirectDbbOptions): DbbTransport {
  return async (request) => {
    const { url, ...init } = dbbFetchInput(
      options.baseUrl,
      dbbHttpRequest(request),
      { accept: 'application/json', 'user-agent': options.userAgent }
    );
    const response = await options.fetch(url, {
      ...init,
      credentials: 'omit',
      redirect: 'error',
      signal: AbortSignal.timeout(options.timeoutMs),
    });
    if (!response.ok) {
      throw new Error(`DBB answered HTTP ${response.status}`);
    }
    return response.json();
  };
}
