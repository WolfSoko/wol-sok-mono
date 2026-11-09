import {
  mergeAssociationClubs,
  type AssociationClubs,
} from '@wolsok/feat-shared-basketball-data';
import { CLUB_INDEX_CACHE_SECONDS } from '../../shared/proxy-cache';
import {
  errorResponse,
  jsonResponse,
  notFound,
  type ProxyResponse,
} from '../dbb/dbb-proxy-response';

/** Reads every Association's list of the club index. */
export type ClubIndexReader = () => Promise<readonly AssociationClubs[]>;

const { browser, cdn } = CLUB_INDEX_CACHE_SECONDS;

/** How long browser and CDN keep the club index. */
export const CLUB_INDEX_CACHE_CONTROL = `public, max-age=${browser}, s-maxage=${cdn}`;

/**
 * `GET /api/clubs` (#2988): every Club of the index, each once, by name,
 * with the Associations it plays in (`IndexedClub[]`), for the device to
 * search; the typed text never reaches the server. Takes no query (404,
 * so the CDN keeps one answer); a failed read is a 502 kept nowhere.
 */
export async function clubIndexResponse(
  read: ClubIndexReader,
  query: URLSearchParams
): Promise<ProxyResponse> {
  if ([...query.keys()].length > 0) {
    return notFound();
  }
  try {
    const clubs = mergeAssociationClubs(await read());
    return jsonResponse(200, JSON.stringify(clubs), {
      'cache-control': CLUB_INDEX_CACHE_CONTROL,
    });
  } catch (error) {
    console.warn('Club index unreadable:', String(error));
    return errorResponse(
      502,
      JSON.stringify({ error: 'club-index-unavailable' })
    );
  }
}
