import { PROXY_ROUTES } from '../../../../../../shared/dbb-proxy-routes';
import { dbbRouteHandler } from '../../../../../dbb/dbb-route-handler';

/**
 * GET /api/dbb/verein/{vereinId}/spiele: DBB
 * `club/id/{vereinId}/actualmatches?rangeDays=…`, the day range fixed.
 */
export default dbbRouteHandler(PROXY_ROUTES['club-games']);
