import {
  computed,
  DestroyRef,
  effect,
  inject,
  Injector,
  linkedSignal,
  untracked,
  type Signal,
} from '@angular/core';
import {
  nextStartIndex,
  type League,
  type LeaguePage,
  type LeagueSearchFilter,
} from '@wolsok/feat-shared-basketball-data';
import { BASKETBALL_DATA } from '../basketball-data/basketball-data.provider';
import { leagueSearchResource } from '../basketball-data/league-search-resource';

/** The Ligen a filter finds, page by page. */
export interface LeaguePages {
  /** The Ligen of every page read so far, in the DBB's order. */
  readonly leagues: Signal<readonly League[]>;
  /** Whether a page is being read. */
  readonly loading: Signal<boolean>;
  /** Whether a page after the last one read exists. */
  readonly more: Signal<boolean>;
  /** Why the last read failed; none while it did not. */
  readonly error: Signal<unknown>;
  /** Reads the next page, if there is one and none is being read. */
  loadMore(): Promise<void>;
}

/** What is read of the pages after the first, for one filter. */
interface NextPages {
  readonly pages: readonly LeaguePage[];
  readonly loading: boolean;
  readonly error: unknown;
}

const NO_NEXT_PAGES: NextPages = {
  pages: [],
  loading: false,
  error: undefined,
};

/**
 * The Ligen of the filter `filter` gives: the first page with the search,
 * every later one through the DBB's list call on `loadMore()`. A new filter
 * starts over and cancels a page still read for the last, as leaving the
 * page does. Created in an injection context, or on `injector`.
 */
export function leaguePages(
  filter: () => LeagueSearchFilter | undefined,
  injector: Injector = inject(Injector)
): LeaguePages {
  const data = injector.get(BASKETBALL_DATA);
  const search = leagueSearchResource(filter, injector);
  const currentFilter = computed(filter);
  const following = linkedSignal<LeagueSearchFilter | undefined, NextPages>({
    source: currentFilter,
    computation: () => NO_NEXT_PAGES,
  });

  const pages = computed((): readonly LeaguePage[] =>
    search.hasValue() ? [search.value().firstPage, ...following().pages] : []
  );
  const nextStart = computed(() => {
    const last = pages().at(-1);
    return last === undefined ? undefined : nextStartIndex(last);
  });

  /** The read of a later page under way, cancelled by a new filter. */
  let running: AbortController | undefined;
  const cancel = (): void => {
    running?.abort();
    running = undefined;
  };
  injector.get(DestroyRef).onDestroy(cancel);
  let seen = untracked(currentFilter);
  effect(
    () => {
      const fresh = currentFilter();
      if (fresh !== seen) {
        seen = fresh;
        untracked(cancel);
      }
    },
    { injector }
  );

  /** Applies `change` while `forFilter` is still the filter. */
  const whileCurrent = (
    forFilter: LeagueSearchFilter,
    change: (sofar: NextPages) => NextPages
  ): void => {
    if (currentFilter() === forFilter) {
      following.update(change);
    }
  };

  return {
    leagues: computed(() => pages().flatMap((page) => page.leagues)),
    loading: computed(() => search.isLoading() || following().loading),
    more: computed(() => nextStart() !== undefined),
    error: computed(() => search.error() ?? following().error),
    loadMore: async () => {
      const forFilter = currentFilter();
      const start = nextStart();
      if (
        forFilter === undefined ||
        start === undefined ||
        following().loading
      ) {
        return;
      }
      whileCurrent(forFilter, (sofar) => ({
        ...sofar,
        loading: true,
        error: undefined,
      }));
      cancel();
      const abort = new AbortController();
      running = abort;
      try {
        const page = await data.leaguePage(forFilter, start, {
          signal: abort.signal,
        });
        whileCurrent(forFilter, (sofar) => ({
          pages: [...sofar.pages, page],
          loading: false,
          error: undefined,
        }));
      } catch (error: unknown) {
        if (!abort.signal.aborted) {
          whileCurrent(forFilter, (sofar) => ({
            ...sofar,
            loading: false,
            error: error,
          }));
        }
      }
    },
  };
}
