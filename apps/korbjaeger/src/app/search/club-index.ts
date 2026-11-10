import { InjectionToken } from '@angular/core';
import {
  BasketballDataError,
  parseIndexedClubs,
  type IndexedClub,
} from '@wolsok/feat-shared-basketball-data';
import {
  browserOnline,
  callProxy,
  PROXY_ZEITLIMIT_MS,
  readJson,
  unavailable,
  type ProxyFetch,
} from '../basketball-data/proxy-call';

/** The app's route serving the club index (#2988). */
export const CLUB_INDEX_PATH = '/api/clubs';

const HTTP_OK = 200;

/** Reads the whole club index, every Club by name; `signal` cancels it. */
export type ClubIndexLoader = (
  signal: AbortSignal
) => Promise<readonly IndexedClub[]>;

/** What the loader asks of the browser beside `fetch`; specs pass fakes. */
export interface ClubIndexOptions {
  /** Whether the browser believes it is online (`navigator.onLine`). */
  readonly online?: () => boolean;
  /** How long the call may take; `PROXY_ZEITLIMIT_MS`. */
  readonly zeitlimitMs?: number;
}

/**
 * The club index from the app's route, which the browser and the CDN keep
 * an hour and a day, so the typed text never leaves the device. Fails as
 * the DBB's reads do: `KeinInternetError` or `offline` where no server
 * answered, `unavailable` for any answer but a 200, `unexpected-shape`
 * for a 200 it cannot read. Nothing is kept in the device's storage.
 */
export function proxyClubIndex(
  fetchProxy: ProxyFetch,
  {
    online = browserOnline,
    zeitlimitMs = PROXY_ZEITLIMIT_MS,
  }: ClubIndexOptions = {}
): ClubIndexLoader {
  return async (signal) => {
    const response = await callProxy(CLUB_INDEX_PATH, fetchProxy, online, {
      signal,
      zeitlimitMs,
    });
    if (response.status !== HTTP_OK) {
      throw unavailable(CLUB_INDEX_PATH, `HTTP ${response.status}`);
    }
    const clubs = parseIndexedClubs(await readJson(CLUB_INDEX_PATH, response));
    if (clubs === undefined) {
      throw new BasketballDataError(
        'unexpected-shape',
        `${CLUB_INDEX_PATH}: not a club index`
      );
    }
    return clubs;
  };
}

/** The club index the search reads; specs provide a fake. */
export const CLUB_INDEX = new InjectionToken<ClubIndexLoader>('ClubIndex', {
  providedIn: 'root',
  factory: () => proxyClubIndex((url, init) => fetch(url, init)),
});
