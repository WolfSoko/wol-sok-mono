import { PROXY_ROUTES } from '../../../../../shared/dbb-proxy-routes';
import { dbbRouteHandler } from '../../../../dbb/dbb-route-handler';

/**
 * GET /api/dbb/ligen/seite?start=&verband=&altersklasse=&geschlecht=: DBB
 * `POST wam/liga/list?startAtIndex=`, a later page of the Liga search.
 */
export default dbbRouteHandler(PROXY_ROUTES['liga-seite']);
