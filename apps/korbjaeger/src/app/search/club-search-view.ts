import type { ClubFinder, IndexedClub } from '@wolsok/feat-shared-basketball-data';
import { vereinslisteFehlerText } from '../fehler/fehler-text';

/** How many hits the search lists at most: a longer list helps nobody. */
export const MAX_CLUB_HITS = 25;

/** How many characters a term needs before the search lists hits. */
export const MIN_TERM_LENGTH = 2;

/** One Verein as the search lists it. */
export interface ClubHit {
  readonly id: IndexedClub['id'];
  readonly name: string;
  /** The Verbände it plays in, so Vereine of one name tell apart. */
  readonly associations: string;
}

/** What the club search shows for the term typed and its list of Vereine. */
export type ClubSearchView =
  /** Nothing typed yet, or too little to search by. */
  | { readonly kind: 'typing'; readonly tooShort: boolean }
  | { readonly kind: 'loading' }
  | { readonly kind: 'failed'; readonly text: string }
  | {
      readonly kind: 'hits';
      readonly hits: readonly ClubHit[];
      /** Whether more Vereine match than are listed. */
      readonly more: boolean;
    };

/** Where the list of Vereine stands, and the term typed. */
export interface ClubSearchState {
  /** Searches the list, once it is loaded. */
  readonly find: ClubFinder<IndexedClub> | undefined;
  /** Why the list failed to load, if it did. */
  readonly error: unknown;
  readonly term: string;
}

/**
 * The club search's view: why the list of Vereine failed, what to type,
 * that the list still loads, else the first `MAX_CLUB_HITS` matches.
 */
export function clubSearchView({
  find,
  error,
  term,
}: ClubSearchState): ClubSearchView {
  const text = vereinslisteFehlerText(error);
  if (text !== undefined) {
    return { kind: 'failed', text };
  }
  const length = term.trim().length;
  if (length < MIN_TERM_LENGTH) {
    return { kind: 'typing', tooShort: length > 0 };
  }
  if (find === undefined) {
    return { kind: 'loading' };
  }
  const matches = find(term);
  return {
    kind: 'hits',
    hits: matches.slice(0, MAX_CLUB_HITS).map(hitOf),
    more: matches.length > MAX_CLUB_HITS,
  };
}

function hitOf({ id, name, associations }: IndexedClub): ClubHit {
  return {
    id,
    name,
    associations: associations.map((association) => association.name).join(' · '),
  };
}
