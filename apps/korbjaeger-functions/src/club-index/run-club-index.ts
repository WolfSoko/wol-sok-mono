import {
  angeboten,
  crawlClubs,
  KEIN_LIGA_FILTER,
  type AssociationClubs,
  type BasketballData,
  type VerbandId,
} from '@wolsok/feat-shared-basketball-data';
import {
  associationToCrawl,
  type ClubIndexSchedule,
} from './association-to-crawl';

/** What the index holds: its lists, and crawls that left none yet. */
export interface ClubIndexState {
  /** Every list the index holds, skipping any it cannot read. */
  readonly lists: readonly AssociationClubs[];
  /** When a crawl of an Association last started, in milliseconds. */
  readonly attempts: ReadonlyMap<VerbandId, number>;
}

/** Where the index keeps one list per Association. */
export interface ClubIndexStore {
  read(): Promise<ClubIndexState>;
  /** Notes that a crawl of `association` starts `at`, keeping its list. */
  markAttempt(association: VerbandId, at: number): Promise<void>;
  /** Replaces the list of `list.association`, and its attempt. */
  save(list: AssociationClubs): Promise<void>;
  /** Deletes the list of an Association the DBB no longer offers. */
  remove(association: VerbandId): Promise<void>;
}

/** What a run needs. */
export interface ClubIndexRun {
  readonly data: BasketballData;
  readonly store: ClubIndexStore;
  readonly now: () => number;
  /** Waits before each read of `data` but the run's first. */
  readonly pause: () => Promise<void>;
  readonly schedule: ClubIndexSchedule;
}

/** What a run did, for the log: no Club named. */
export interface ClubIndexResult {
  /** Lists of Associations the DBB no longer offers, deleted. */
  readonly removed: number;
  readonly crawled?: {
    readonly association: VerbandId;
    readonly clubs: number;
    /** Clubs a Team's name stands in for, read again next time. */
    readonly namedByTeam: number;
  };
}

/**
 * One run of the club index (#2988): deletes the lists of Associations the
 * DBB no longer offers, then crawls the Association due first
 * (`associationToCrawl`) and replaces its list. It notes the crawl's start
 * first, so a crawl that fails or runs out of time holds up no other
 * Association; a failed crawl writes no list, so the old one stays. Clubs'
 * own names known from any list are not read again.
 */
export async function runClubIndex(
  run: ClubIndexRun
): Promise<ClubIndexResult> {
  const search = await run.data.ligaSuche(KEIN_LIGA_FILTER);
  const associations = angeboten(search.facetten.verbaende).map(
    ({ id, name }) => ({ id, name })
  );
  const state = await run.store.read();
  const removed = await removeUnoffered(run.store, state, associations);
  const start = run.now();
  const association = associationToCrawl(
    associations,
    state.lists,
    state.attempts,
    run.schedule,
    start
  );
  if (association === undefined) {
    return { removed };
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
    crawled: {
      association: association.id,
      clubs: clubs.length,
      namedByTeam: clubs.filter(({ nameFromTeam }) => nameFromTeam).length,
    },
  };
}

/**
 * Deletes the lists of Associations missing from `offered`, unless the DBB
 * offered none at all (then it is the DBB that is off, not the lists).
 */
async function removeUnoffered(
  store: ClubIndexStore,
  state: ClubIndexState,
  offered: readonly { readonly id: VerbandId }[]
): Promise<number> {
  if (offered.length === 0) {
    return 0;
  }
  const ids = new Set(offered.map(({ id }) => id));
  const gone = state.lists.filter(
    ({ association }) => !ids.has(association.id)
  );
  for (const { association } of gone) {
    await store.remove(association.id);
  }
  return gone.length;
}
