import { PROXY_ROUTES } from '../../../../shared/dbb-proxy-routes';
import { dbbRouteHandler } from '../../../dbb/dbb-route-handler';

/**
 * GET /api/dbb/ligen?verband=&altersklasse=&geschlecht=: DBB `POST
 * wam/data`, the Liga search's facets and first page.
 */
export default dbbRouteHandler(PROXY_ROUTES['liga-suche']);
