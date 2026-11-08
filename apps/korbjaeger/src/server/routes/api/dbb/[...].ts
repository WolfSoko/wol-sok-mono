import { unknownDbbPathHandler } from '../../../dbb/dbb-proxy-response';

/** Every other path under /api/dbb/: 404, the DBB is never asked. */
export default unknownDbbPathHandler;
