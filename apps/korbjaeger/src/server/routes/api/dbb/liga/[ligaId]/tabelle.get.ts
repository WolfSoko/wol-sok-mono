import { PROXY_ROUTES } from '../../../../../../shared/dbb-proxy-routes';
import { dbbRouteHandler } from '../../../../../dbb/dbb-route-handler';

/** GET /api/dbb/liga/{ligaId}/tabelle: DBB `competition/table/id/{ligaId}`. */
export default dbbRouteHandler(PROXY_ROUTES.tabelle);
