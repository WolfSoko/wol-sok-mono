import { useRuntimeConfig } from 'nitropack/runtime';
import type { NitroRuntimeConfig } from 'nitropack/types';
import type { AnyProxyRoute } from '../../shared/dbb-proxy-routes';
import { proxyRouteHandler } from './dbb-proxy';
import { dbbUpstreamOf, type DbbProxyConfig } from './dbb-upstream-config';

/** A route file's handler: `route` over the DBB Nitro's runtime config names. */
export function dbbRouteHandler(route: AnyProxyRoute) {
  return proxyRouteHandler(
    route,
    dbbUpstreamOf(useRuntimeConfig<NitroRuntimeConfig & DbbProxyConfig>())
  );
}
