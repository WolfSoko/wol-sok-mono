import {
  BasketballDataError,
  offered,
  crawlClubs,
  NO_LEAGUE_FILTER,
  type AssociationClubs,
  type ClubCrawlSource,
  type AssociationId,
} from '@wolsok/feat-shared-basketball-data';
import {
  associationToCrawl,
  overdueListless,
  type ClubIndexSchedule,
} from './association-to-crawl';

/** How much of a failed crawl's error the index keeps (`lastError`). */
export const LAST_ERROR_LENGTH = 200;

/** The `lastError` of a warning where no crawl stored one (a timeout). */
export const NO_ERROR_RECORDED = 'none recorded';

/**
 * What the index holds: its lists, crawls that left none yet, and which
 * Associations it holds a document of and has noted as offered.
 */
export interface ClubIndexState {
  /** Every list the index holds, skipping any it cannot read. */
  readonly lists: readonly AssociationClubs[];
  /** When a crawl of an Association last started, in milliseconds. */
  readonly attempts: ReadonlyMap<AssociationId, number>;
  /** The Associations the index holds a document of, list or not. */
  readonly ids: ReadonlySet<AssociationId>;
  /** Those of `ids` marked as offered (`OFFERED_ASSOCIATION`). */
  readonly offered: ReadonlySet<AssociationId>;
  /**
   * When the first attempt that found no list of an Association started,
   * in milliseconds, while it still has none (#3022).
   */
  readonly listlessSince: ReadonlyMap<AssociationId, number>;
  /** The error of an Association's last failed crawl, while it has no list. */
  readonly lastErrors: ReadonlyMap<AssociationId, string>;
}

/** Where the index keeps one list per Association. */
export interface ClubIndexStore {
  read(): Promise<ClubIndexState>;
  /**
   * Marks each of `associations` as offered, keeping a list it has, so the
   * server sees the index is incomplete until each has one (#3005).
   */
  noteOffered(associations: readonly AssociationId[]): Promise<void>;
  /**
   * Notes that a crawl of `association` starts `at`, keeping its list; for
   * one without a list also since when it has had none (`listlessSince`).
   */
  markAttempt(
    association: AssociationId,
    at: number,
    listlessSince?: number
  ): Promise<void>;
  /** Notes the error a crawl of `association` failed with. */
  markFailure(association: AssociationId, error: string): Promise<void>;
  /**
   * Replaces the list of `list.association`, and its attempt, its
   * `listlessSince` and its last error.
   */
  save(list: AssociationClubs): Promise<void>;
  /** Deletes the document of an Association the DBB no longer offers. */
  remove(association: AssociationId): Promise<void>;
}

/** What a run needs. */
export interface ClubIndexRun {
  readonly data: ClubCrawlSource;
  readonly store: ClubIndexStore;
  readonly now: () => number;
  /** Waits before each read of `data` but the run's first. */
  readonly pause: () => Promise<void>;
  readonly schedule: ClubIndexSchedule;
  /** Reports an Association that has had no list for too long. */
  readonly warn: (warning: ListlessWarning) => void;
}

/** An offered Association without a list for too long, for the log. */
export interface ListlessWarning {
  readonly association: AssociationId;
  /** Since when it has had no list, as an ISO time. */
  readonly listlessSince: string;
  /** Its last crawl's error, or `NO_ERROR_RECORDED`. */
  readonly lastError: string;
}

/** What a run did, for the log: no Club named. */
export interface ClubIndexResult {
  /** Documents of Associations the DBB no longer offers, deleted. */
  readonly removed: number;
  /** Offered Associations marked as such (`noteOffered`) by this run. */
  readonly noted: number;
  /** Offered Associations that held no list at the run's start (#3022). */
  readonly withoutList: number;
  readonly crawled?: {
    readonly association: AssociationId;
    readonly clubs: number;
    /** Clubs a Team's name stands in for, read again next time. */
    readonly namedByTeam: number;
  };
}

/**
 * One run of the club index (#2988): deletes the documents of Associations
 * the DBB no longer offers, marks each offered one not marked yet (so the
 * server can tell the index is complete, #3005), then
 * crawls the Association due first
 * (`associationToCrawl`) and replaces its list. It notes the crawl's start
 * first, so a crawl that fails or runs out of time holds up no other
 * Association; a failed crawl writes no list, so the old one stays, and
 * notes its error. Clubs' own names known from any list are not read again.
 * Before it crawls, it warns of each offered Association without a list
 * for too long (`overdueListless`, #3022), as a failing crawl rejects.
 */
export async function runClubIndex(
  run: ClubIndexRun
): Promise<ClubIndexResult> {
  const search = await run.data.leagueSearch(NO_LEAGUE_FILTER);
  const associations = offered(search.facets.associations).map(
    ({ id, name }) => ({ id, name })
  );
  const state = await run.store.read();
  const removed = await removeUnoffered(run.store, state, associations);
  const start = run.now();
  const unnoted = associations
    .map(({ id }) => id)
    .filter((id) => !state.offered.has(id));
  if (unnoted.length > 0) {
    await run.store.noteOffered(unnoted);
  }
  const noted = unnoted.length;
  const listed = new Set(state.lists.map((list) => list.association.id));
  const withoutList = associations.filter(({ id }) => !listed.has(id)).length;
  warnOfOverdue(run, associations, state, start);
  const association = associationToCrawl(
    associations,
    state.lists,
    state.attempts,
    run.schedule,
    start
  );
  if (association === undefined) {
    return { removed, noted, withoutList };
  }
  await run.store.markAttempt(
    association.id,
    start,
    listed.has(association.id)
      ? undefined
      : (state.listlessSince.get(association.id) ?? start)
  );
  const knownNames = new Map(
    state.lists.flatMap(({ clubs }) =>
      clubs
        .filter(({ nameFromTeam }) => nameFromTeam !== true)
        .map(({ id, name }) => [id, name] as const)
    )
  );
  const clubs = await crawlClubs(run.data, association.id, {
    knownNames,
    pause: run.pause,
    timeForNames: () => run.now() - start < run.schedule.namesForMs,
  }).catch(async (error: unknown) => {
    // the crawl's own error matters more than one noting it
    await run.store
      .markFailure(association.id, errorText(error))
      .catch(() => undefined);
    throw error;
  });
  await run.store.save({ association, clubs, updatedAt: run.now() });
  return {
    removed,
    noted,
    withoutList,
    crawled: {
      association: association.id,
      clubs: clubs.length,
      namedByTeam: clubs.filter(({ nameFromTeam }) => nameFromTeam).length,
    },
  };
}

/**
 * Deletes every document (list, attempt or note) of an Association missing
 * from `offered`, so none keeps the index incomplete; unless the DBB
 * offered none at all (then it is the DBB that is off, not the lists).
 */
async function removeUnoffered(
  store: ClubIndexStore,
  state: ClubIndexState,
  offered: readonly { readonly id: AssociationId }[]
): Promise<number> {
  if (offered.length === 0) {
    return 0;
  }
  const ids = new Set(offered.map(({ id }) => id));
  const gone = [...state.ids].filter((id) => !ids.has(id));
  for (const id of gone) {
    await store.remove(id);
  }
  return gone.length;
}

/** Warns of each offered Association without a list for too long. */
function warnOfOverdue(
  run: ClubIndexRun,
  associations: readonly {
    readonly id: AssociationId;
    readonly name: string;
  }[],
  state: ClubIndexState,
  now: number
): void {
  for (const { association, listlessSince } of overdueListless(
    associations,
    state.lists,
    state.listlessSince,
    run.schedule,
    now
  )) {
    run.warn({
      association,
      listlessSince: new Date(listlessSince).toISOString(),
      lastError: state.lastErrors.get(association) ?? NO_ERROR_RECORDED,
    });
  }
}

/**
 * A failed crawl's error as the index keeps it: its kind (or name) and
 * message, cut to `LAST_ERROR_LENGTH`; they name paths and statuses, no
 * Club or person.
 */
function errorText(error: unknown): string {
  const label =
    error instanceof BasketballDataError
      ? error.kind
      : error instanceof Error
        ? error.name
        : 'unknown';
  const message = error instanceof Error ? error.message : String(error);
  return `${label}: ${message}`.slice(0, LAST_ERROR_LENGTH);
}
