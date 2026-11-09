import { PROXY_ROUTES } from '../../../../../shared/dbb-proxy-routes';
import { dbbRouteHandler } from '../../../../dbb/dbb-route-handler';

/** GET /api/dbb/spiel/{spielId}: DBB `match/id/{spielId}/matchInfo`. */
export default dbbRouteHandler(PROXY_ROUTES['spiel-info']);
