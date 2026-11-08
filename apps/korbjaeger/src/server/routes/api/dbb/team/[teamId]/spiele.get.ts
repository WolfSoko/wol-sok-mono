import { teamSpieleHandler } from '../../../../../dbb/dbb-proxy';
import { dbbUpstreamFromEnv } from '../../../../../dbb/dbb-upstream-config';

/** GET /api/dbb/team/{teamId}/spiele: DBB `team/id/{teamId}/matches`. */
export default teamSpieleHandler(dbbUpstreamFromEnv());
