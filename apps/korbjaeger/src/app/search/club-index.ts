import { inject, Injectable, InjectionToken, signal } from '@angular/core';
import {
  clubSearch,
  parseIndexedClubs,
  type IndexedClub,
} from '@wolsok/feat-shared-basketball-data';
import {
  browserOnline,
  HTTP_OK,
  PROXY_ZEITLIMIT_MS,
  reachProxy,
  readProxyJson,
  unavailableError,
  type ProxyFetch,
} from '../basketball-data/proxy-fetch';

/** Where the app's server serves the club index (#2988). */
export const CLUB_INDEX_PATH = '/api/clubs';

/** The `fetch` the club index is read with; specs pass a fake. */
export const CLUB_INDEX_FETCH = new InjectionToken<ProxyFetch>(
  'ClubIndexFetch',
  { providedIn: 'root', factory: () => (url, init) => fetch(url, init) }
);

/** Where the club index stands on this device. */
export type ClubIndexState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'loading' }
  | {
      readonly kind: 'loaded';
      /** How many Clubs the index holds; none while it is still being built. */
      readonly size: number;
      /** The Clubs whose name holds every word of a term, by name. */
      readonly search: (term: string) => readonly IndexedClub[];
    }
  | { readonly kind: 'failed'; readonly error: unknown };

/**
 * The club index, loaded from the app's server once per start, once the
 * search is used, and kept in memory, so typing sends nothing: the device
 * searches the list itself. A failed load can be tried again.
 */
@Injectable({ providedIn: 'root' })
export class ClubIndex {
  private readonly fetchProxy = inject(CLUB_INDEX_FETCH);
  private readonly current = signal<ClubIndexState>({ kind: 'idle' });

  public readonly state = this.current.asReadonly();

  /**
   * Loads the index, unless it is loading or loaded already; an empty one
   * (its first fill still running) is read again, as a failed one is.
   */
  public load(): void {
    const state = this.current();
    if (
      state.kind === 'loading' ||
      (state.kind === 'loaded' && state.size > 0)
    ) {
      return;
    }
    this.current.set({ kind: 'loading' });
    readClubIndex(this.fetchProxy).then(
      (clubs) =>
        this.current.set({
          kind: 'loaded',
          size: clubs.length,
          search: clubSearch(clubs),
        }),
      (error: unknown) => this.current.set({ kind: 'failed', error })
    );
  }
}

async function readClubIndex(
  fetchProxy: ProxyFetch
): Promise<readonly IndexedClub[]> {
  const response = await reachProxy(CLUB_INDEX_PATH, fetchProxy, {
    online: browserOnline,
    signal: undefined,
    zeitlimitMs: PROXY_ZEITLIMIT_MS,
  });
  if (response.status !== HTTP_OK) {
    throw unavailableError(CLUB_INDEX_PATH, `HTTP ${response.status}`);
  }
  return parseIndexedClubs(await readProxyJson(CLUB_INDEX_PATH, response));
}
