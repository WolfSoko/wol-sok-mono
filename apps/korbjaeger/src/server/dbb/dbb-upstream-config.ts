import { DBB_BASE_URL } from '@wolsok/feat-shared-basketball-data';
import { WORKSPACE_VERSION } from '@wolsok/utils-version';
import { SITE_URL } from '../../shared/site';
import { dbbUpstream, type DbbUpstream } from './dbb-upstream';

/** How long the proxy waits for the DBB. */
export const DBB_TIMEOUT_MS = 5000;

/** How the proxy introduces itself to the DBB (ADR 0018). */
export const PROXY_USER_AGENT = `Korbjaeger/${WORKSPACE_VERSION} (+${SITE_URL})`;

/** The proxy's part of Nitro's runtime config (`vite.config.ts`). */
export interface DbbProxyConfig {
  /**
   * The DBB's API; empty for the real one. The e2e build sets the fake
   * DBB's, and `NITRO_DBB_BASE_URL` overrides it at run time.
   */
  readonly dbbBaseUrl: string;
}

/** The DBB's API the proxy reads, by `config`. */
export function dbbBaseUrl(config: DbbProxyConfig): string {
  return config.dbbBaseUrl || DBB_BASE_URL;
}

/** The DBB as the proxy calls it, at the base URL `config` names. */
export function dbbUpstreamOf(config: DbbProxyConfig): DbbUpstream {
  return dbbUpstream({
    baseUrl: dbbBaseUrl(config),
    fetch: (url, init) => fetch(url, init),
    timeoutMs: DBB_TIMEOUT_MS,
    userAgent: PROXY_USER_AGENT,
  });
}
