import { useRuntimeConfig } from 'nitropack/runtime';
import type { NitroRuntimeConfig } from 'nitropack/types';
import { TEAM_SPIELE_ROUTE } from '../../../../../../shared/dbb-proxy-routes';
import { proxyRouteHandler } from '../../../../../dbb/dbb-proxy';
import {
  dbbUpstreamOf,
  type DbbProxyConfig,
} from '../../../../../dbb/dbb-upstream-config';

/** GET /api/dbb/team/{teamId}/spiele: DBB `team/id/{teamId}/matches`. */
export default proxyRouteHandler(
  TEAM_SPIELE_ROUTE,
  dbbUpstreamOf(useRuntimeConfig<NitroRuntimeConfig & DbbProxyConfig>())
);
