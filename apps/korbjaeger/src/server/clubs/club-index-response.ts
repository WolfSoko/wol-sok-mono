import {
  mergeAssociationClubs,
  type StoredClubIndex,
} from '@wolsok/feat-shared-basketball-data';
import { CLUB_INDEX_CACHE_SECONDS } from '../../shared/proxy-cache';
import {
  errorResponse,
  jsonResponse,
  notFound,
  publicCacheControl,
  type ProxyResponse,
} from '../dbb/dbb-proxy-response';

/** Reads the club index: every Association's list, and if it is complete. */
export type ClubIndexReader = () => Promise<StoredClubIndex>;

/** How long browser and CDN keep the club index, by whether it is complete. */
export const CLUB_INDEX_CACHE_CONTROL = {
  complete: publicCacheControl(
    CLUB_INDEX_CACHE_SECONDS.complete.browser,
    CLUB_INDEX_CACHE_SECONDS.complete.cdn
  ),
  filling: publicCacheControl(
    CLUB_INDEX_CACHE_SECONDS.filling.browser,
    CLUB_INDEX_CACHE_SECONDS.filling.cdn
  ),
} as const;

/**
 * `GET /api/clubs` (#2988): every Club of the index, each once, by name,
 * with the Associations it plays in (`IndexedClub[]`), for the device to
 * search; the typed text never reaches the server. Cached a day once the
 * index is complete, minutes while it is still filling (#3005). Takes no
 * query (404, so the CDN keeps one answer); a failed read is a 502 kept
 * nowhere.
 */
export async function clubIndexResponse(
  read: ClubIndexReader,
  query: URLSearchParams
): Promise<ProxyResponse> {
  if ([...query.keys()].length > 0) {
    return notFound();
  }
  try {
    const { lists, complete } = await read();
    return jsonResponse(200, JSON.stringify(mergeAssociationClubs(lists)), {
      'cache-control':
        CLUB_INDEX_CACHE_CONTROL[complete ? 'complete' : 'filling'],
    });
  } catch (error) {
    console.warn('Club index unreadable:', String(error));
    return errorResponse(
      502,
      JSON.stringify({ error: 'club-index-unavailable' })
    );
  }
}
