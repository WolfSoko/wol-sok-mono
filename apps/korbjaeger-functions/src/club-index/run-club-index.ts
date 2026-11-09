import {
  angeboten,
  crawlClubs,
  KEIN_LIGA_FILTER,
  type AssociationClubs,
  type BasketballData,
} from '@wolsok/feat-shared-basketball-data';
import { associationToCrawl } from './association-to-crawl';

/** Where the index keeps one list per Association. */
export interface ClubIndexStore {
  /** Every list the index holds, skipping any it cannot read. */
  all(): Promise<readonly AssociationClubs[]>;
  /** Replaces the list of `list.association`. */
  save(list: AssociationClubs): Promise<void>;
}

/** What a run needs. */
export interface ClubIndexRun {
  readonly data: BasketballData;
  readonly store: ClubIndexStore;
  readonly now: () => number;
  /** Waits between two reads of `data`. */
  readonly pause: () => Promise<void>;
  /** How old a list may grow before a run crawls its Association again. */
  readonly maxAgeMs: number;
}

/** What a run did, for the log: no Club named. */
export type ClubIndexResult =
  | { readonly crawled: false }
  | {
      readonly crawled: true;
      readonly association: number;
      readonly clubs: number;
    };

/**
 * One run of the club index (#2988): crawls the Association the index is
 * missing or holds the oldest list of (`associationToCrawl`) and replaces
 * its list. Names known from any list are not read again. A failed crawl
 * rejects before anything is written, so the old list stays.
 */
export async function runClubIndex(
  run: ClubIndexRun
): Promise<ClubIndexResult> {
  const search = await run.data.ligaSuche(KEIN_LIGA_FILTER);
  const associations = angeboten(search.facetten.verbaende).map(
    ({ id, name }) => ({ id, name })
  );
  const stored = await run.store.all();
  const association = associationToCrawl(
    associations,
    stored,
    run.now(),
    run.maxAgeMs
  );
  if (association === undefined) {
    return { crawled: false };
  }
  const knownNames = new Map(
    stored.flatMap(({ clubs }) => clubs.map(({ id, name }) => [id, name]))
  );
  await run.pause();
  const clubs = await crawlClubs(run.data, association.id, {
    knownNames,
    pause: run.pause,
  });
  await run.store.save({ association, clubs, updatedAt: run.now() });
  return { crawled: true, association: association.id, clubs: clubs.length };
}
