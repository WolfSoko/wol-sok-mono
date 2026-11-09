import { unknownDbbPathHandler } from '../../../dbb/dbb-proxy-response';

/** /api/dbb itself: 404, as every path that is no allowlisted read. */
export default unknownDbbPathHandler;
