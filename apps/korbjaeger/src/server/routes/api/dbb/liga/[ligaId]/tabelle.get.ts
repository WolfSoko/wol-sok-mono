import { useRuntimeConfig } from 'nitropack/runtime';
import type { NitroRuntimeConfig } from 'nitropack/types';
import { TABELLE_ROUTE } from '../../../../../../shared/dbb-proxy-routes';
import { proxyRouteHandler } from '../../../../../dbb/dbb-proxy';
import {
  dbbUpstreamOf,
  type DbbProxyConfig,
} from '../../../../../dbb/dbb-upstream-config';

/** GET /api/dbb/liga/{ligaId}/tabelle: DBB `competition/table/id/{ligaId}`. */
export default proxyRouteHandler(
  TABELLE_ROUTE,
  dbbUpstreamOf(useRuntimeConfig<NitroRuntimeConfig & DbbProxyConfig>())
);
