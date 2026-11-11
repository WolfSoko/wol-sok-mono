import { PROXY_ROUTES } from '../../../../../../shared/dbb-proxy-routes';
import { dbbRouteHandler } from '../../../../../dbb/dbb-route-handler';

/** GET /api/dbb/team/{teamId}/spiele: DBB `team/id/{teamId}/matches`. */
export default dbbRouteHandler(PROXY_ROUTES['team-games']);
