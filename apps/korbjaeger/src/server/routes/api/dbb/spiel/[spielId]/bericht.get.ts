import { PROXY_ROUTES } from '../../../../../../shared/dbb-proxy-routes';
import { dbbRouteHandler } from '../../../../../dbb/dbb-route-handler';

/** GET /api/dbb/spiel/{spielId}/bericht: DBB `match/id/{spielId}/boxscore`. */
export default dbbRouteHandler(PROXY_ROUTES['game-report']);
