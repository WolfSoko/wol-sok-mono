import { useRuntimeConfig } from 'nitropack/runtime';
import type { NitroRuntimeConfig } from 'nitropack/types';
import { teamSpieleHandler } from '../../../../../dbb/dbb-proxy';
import {
  dbbUpstreamOf,
  type DbbProxyConfig,
} from '../../../../../dbb/dbb-upstream-config';

/** GET /api/dbb/team/{teamId}/spiele: DBB `team/id/{teamId}/matches`. */
export default teamSpieleHandler(
  dbbUpstreamOf(useRuntimeConfig<NitroRuntimeConfig & DbbProxyConfig>())
);
