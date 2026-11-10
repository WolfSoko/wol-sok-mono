import { defineEventHandler, getRequestURL } from 'h3';
import { clubIndexResponse } from '../../clubs/club-index-response';
import { firestoreClubIndexReader } from '../../clubs/firestore-club-index-reader';
import { sendProxyResponse } from '../../dbb/dbb-proxy-response';

/**
 * GET /api/clubs: the club index (#2988), cached a day by the CDN once
 * complete, minutes while it fills (#3005).
 */
export default defineEventHandler(async (event) =>
  sendProxyResponse(
    event,
    await clubIndexResponse(
      firestoreClubIndexReader,
      getRequestURL(event).searchParams
    )
  )
);
