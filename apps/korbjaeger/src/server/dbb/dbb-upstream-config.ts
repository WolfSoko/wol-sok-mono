import { DBB_BASE_URL } from '@wolsok/feat-shared-basketball-data';
import { WORKSPACE_VERSION } from '@wolsok/utils-version';
import { SITE_URL } from '../../app/site';
import { dbbUpstream, type DbbUpstream } from './dbb-upstream';

/** How long the proxy waits for the DBB. */
export const DBB_TIMEOUT_MS = 5000;

/** How the proxy introduces itself to the DBB (ADR 0018). */
export const PROXY_USER_AGENT = `Korbjaeger/${WORKSPACE_VERSION} (+${SITE_URL})`;

/** The DBB's API, or what `DBB_BASE_URL` names instead (the e2e fake). */
export function dbbBaseUrl(env: NodeJS.ProcessEnv): string {
  return env['DBB_BASE_URL'] || DBB_BASE_URL;
}

/** The DBB as the deployed proxy and `nx serve` call it. */
export function dbbUpstreamFromEnv(
  env: NodeJS.ProcessEnv = process.env
): DbbUpstream {
  return dbbUpstream({
    baseUrl: dbbBaseUrl(env),
    fetch: (url, init) => fetch(url, init),
    timeoutMs: DBB_TIMEOUT_MS,
    userAgent: PROXY_USER_AGENT,
  });
}
