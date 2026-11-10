import {
  offered,
  crawlClubs,
  NO_LEAGUE_FILTER,
  type AssociationClubs,
  type ClubCrawlSource,
  type AssociationId,
} from '@wolsok/feat-shared-basketball-data';
import {
  associationToCrawl,
  type ClubIndexSchedule,
} from './association-to-crawl';

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
}

/** Where the index keeps one list per Association. */
export interface ClubIndexStore {
  read(): Promise<ClubIndexState>;
  /**
   * Marks each of `associations` as offered, keeping a list it has, so the
   * server sees the index is incomplete until each has one (#3005).
   */
  noteOffered(associations: readonly AssociationId[]): Promise<void>;
  /** Notes that a crawl of `association` starts `at`, keeping its list. */
  markAttempt(association: AssociationId, at: number): Promise<void>;
  /** Replaces the list of `list.association`, and its attempt. */
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
}

/** What a run did, for the log: no Club named. */
export interface ClubIndexResult {
  /** Documents of Associations the DBB no longer offers, deleted. */
  readonly removed: number;
  /** Offered Associations marked as such (`noteOffered`) by this run. */
  readonly noted: number;
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
 * Association; a failed crawl writes no list, so the old one stays. Clubs'
 * own names known from any list are not read again.
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
  const association = associationToCrawl(
    associations,
    state.lists,
    state.attempts,
    run.schedule,
    start
  );
  if (association === undefined) {
    return { removed, noted };
  }
  await run.store.markAttempt(association.id, start);
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
  });
  await run.store.save({ association, clubs, updatedAt: run.now() });
  return {
    removed,
    noted,
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
