import { PROXY_ROUTES } from '../../../../../../shared/dbb-proxy-routes';
import { dbbRouteHandler } from '../../../../../dbb/dbb-route-handler';

/**
 * GET /api/dbb/liga/{ligaId}/spielplan: DBB
 * `competition/spielplan/id/{ligaId}`, which names the Liga's Teams.
 */
export default dbbRouteHandler(PROXY_ROUTES.spielplan);
