import type { VereinId } from '../domain/ids';
import type { Verband } from '../domain/verband';

/** A Club as the index keeps it: its DBB id and name, nothing else. */
export interface ClubIndexEntry {
  readonly id: VereinId;
  readonly name: string;
  /**
   * Set where the Club's own name could not be read (in time) and one of
   * its Teams' names stands in: the next crawl reads it again.
   */
  readonly nameFromTeam?: true;
}

/** The Clubs playing in one Association's Leagues, as one crawl found them. */
export interface AssociationClubs {
  readonly association: Verband;
  /** By name. */
  readonly clubs: readonly ClubIndexEntry[];
  /** When the crawl ended, in milliseconds since the epoch. */
  readonly updatedAt: number;
}

/** A Club of the index with every Association it plays in. */
export interface IndexedClub {
  readonly id: VereinId;
  readonly name: string;
  /** By name. */
  readonly associations: readonly Verband[];
}

const BY_NAME = new Intl.Collator('de');

/**
 * The index of every Club in `lists`, each once, by name: a Club playing in
 * several Associations' Leagues (a Regionalliga beside its Landesverband)
 * lists all of them, and takes its name from the newest list that read the
 * Club's own name (a Team's name only where none did).
 */
export function mergeAssociationClubs(
  lists: readonly AssociationClubs[]
): readonly IndexedClub[] {
  const newestFirst = [...lists].sort((a, b) => b.updatedAt - a.updatedAt);
  const clubs = new Map<
    VereinId,
    { name: string; fromTeam: boolean; associations: Verband[] }
  >();
  for (const { association, clubs: entries } of newestFirst) {
    for (const { id, name, nameFromTeam } of entries) {
      const fromTeam = nameFromTeam === true;
      const club = clubs.get(id) ?? { name, fromTeam, associations: [] };
      if (club.fromTeam && !fromTeam) {
        club.name = name;
        club.fromTeam = false;
      }
      club.associations.push(association);
      clubs.set(id, club);
    }
  }
  return [...clubs]
    .map(([id, { name, associations }]) => ({
      id,
      name,
      associations: associations.sort(byClubName),
    }))
    .sort(byClubName);
}

/**
 * The Clubs of `index` whose name holds every word of `term`, in the
 * index's order; none for a term without words. Case, diacritics and `ß`
 * do not matter: `wasbuttel` finds `MTV Wasbüttel`.
 */
export function clubsMatching<C extends { readonly name: string }>(
  index: readonly C[],
  term: string
): readonly C[] {
  const words = folded(term).split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return [];
  }
  return index.filter((club) => {
    const name = folded(club.name);
    return words.every((word) => name.includes(word));
  });
}

/** Orders Clubs as the index lists them: by name, German collation. */
export function byClubName(
  a: { readonly name: string },
  b: { readonly name: string }
): number {
  return BY_NAME.compare(a.name, b.name);
}

function folded(text: string): string {
  return text
    .toLocaleLowerCase('de')
    .replaceAll('ß', 'ss')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim();
}
