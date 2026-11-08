import type { DbbHttpRequest } from '@wolsok/feat-shared-basketball-data';

/** The `fetch` the proxy calls the DBB with; specs pass a fake. */
export type UpstreamFetch = (
  url: string,
  init: RequestInit
) => Promise<Response>;

/** How the proxy calls the DBB. */
export interface DbbUpstreamOptions {
  /** The DBB's API, `DbbHttpRequest.path` is relative to it. */
  readonly baseUrl: string;
  readonly fetch: UpstreamFetch;
  /** How long a call, body included, may take before it counts as failed. */
  readonly timeoutMs: number;
  readonly userAgent: string;
}

/** The DBB's answer to one call: its body, or why there is none. */
export type UpstreamAnswer =
  | { readonly ok: true; readonly body: string }
  | { readonly ok: false; readonly reason: string };

/** One call to the DBB. Never rejects: a failure is an answer too. */
export type DbbUpstream = (request: DbbHttpRequest) => Promise<UpstreamAnswer>;

/**
 * Calls the DBB as a guest it barely notices: with its own User-Agent and
 * nothing of the visitor's (no cookies, no headers of theirs), within
 * `timeoutMs`. The DBB answers HTTP 200 even when a read fails, so any
 * other status is a failure.
 */
export function dbbUpstream(options: DbbUpstreamOptions): DbbUpstream {
  const baseUrl = options.baseUrl.replace(/\/+$/, '');
  return async (request) => {
    try {
      const response = await options.fetch(`${baseUrl}/${request.path}`, {
        ...requestBody(request),
        method: request.method,
        headers: {
          accept: 'application/json',
          'user-agent': options.userAgent,
          ...(request.method === 'POST'
            ? { 'content-type': 'application/json' }
            : {}),
        },
        credentials: 'omit',
        redirect: 'error',
        signal: AbortSignal.timeout(options.timeoutMs),
      });
      if (!response.ok) {
        return { ok: false, reason: `HTTP ${response.status}` };
      }
      return { ok: true, body: await response.text() };
    } catch (error) {
      return { ok: false, reason: failureReason(error) };
    }
  };
}

function requestBody(request: DbbHttpRequest): Pick<RequestInit, 'body'> {
  return request.method === 'POST'
    ? { body: JSON.stringify(request.body) }
    : {};
}

/**
 * Why a call failed, for the logs: the error's name and message and its
 * cause's (Node's fetch says "fetch failed" and names a refused redirect
 * or connection only in the cause). A timeout is a `TimeoutError`.
 */
function failureReason(error: unknown): string {
  const reason = describe(error);
  const cause = describe((error as { readonly cause?: unknown } | null)?.cause);
  return cause === undefined ? (reason ?? 'unknown') : `${reason} (${cause})`;
}

function describe(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }
  const { name, message } = error as {
    readonly name?: unknown;
    readonly message?: unknown;
  };
  return `${String(name)}: ${String(message)}`;
}
