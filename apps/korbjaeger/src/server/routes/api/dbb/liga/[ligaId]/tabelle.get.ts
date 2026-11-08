import { useRuntimeConfig } from 'nitropack/runtime';
import type { NitroRuntimeConfig } from 'nitropack/types';
import { tabelleHandler } from '../../../../../dbb/dbb-proxy';
import {
  dbbUpstreamOf,
  type DbbProxyConfig,
} from '../../../../../dbb/dbb-upstream-config';

/** GET /api/dbb/liga/{ligaId}/tabelle: DBB `competition/table/id/{ligaId}`. */
export default tabelleHandler(
  dbbUpstreamOf(useRuntimeConfig<NitroRuntimeConfig & DbbProxyConfig>())
);
