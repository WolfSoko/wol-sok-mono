import { isJsonObject } from '../dbb/dbb-object';
import { isDbbId } from '../dbb/dbb-request';
import type { AssociationClubs, ClubIndexEntry } from './club-index';

/** The version of the stored document; a reader skips any other. */
export const CLUB_INDEX_VERSION = 1;

/**
 * One Association's Clubs as a document of the club index stores them:
 * plain values only (`updatedAt` in milliseconds), so the functions that
 * write it and the server that reads it need no Timestamp mapping.
 */
export interface StoredAssociationClubs extends AssociationClubs {
  readonly version: typeof CLUB_INDEX_VERSION;
  /** The crawl knows the Association is offered (`OfferedAssociation`). */
  readonly offered: true;
}

/**
 * The mark of an Association the crawl knows the DBB offers (#3005): on
 * every list it saves, and alone on a document noted before the first
 * crawl. A list without it was stored before the crawl noted Verbände, so
 * the server cannot tell yet whether others are missing.
 */
export const OFFERED_ASSOCIATION = { offered: true } as const;

/** Whether a stored document carries `OFFERED_ASSOCIATION`'s mark. */
export function isOfferedAssociation(data: unknown): boolean {
  return isJsonObject(data) && data['offered'] === true;
}

/** `list` as the index stores it. */
export function storedAssociationClubs(
  list: AssociationClubs
): StoredAssociationClubs {
  return {
    version: CLUB_INDEX_VERSION,
    ...OFFERED_ASSOCIATION,
    association: { id: list.association.id, name: list.association.name },
    clubs: list.clubs.map(entryOf),
    updatedAt: list.updatedAt,
  };
}

/**
 * The list a stored document holds, or `undefined` for one of another
 * version or shape: a reader skips it rather than show half of it.
 */
export function parseAssociationClubs(
  data: unknown
): AssociationClubs | undefined {
  if (!isJsonObject(data) || data['version'] !== CLUB_INDEX_VERSION) {
    return undefined;
  }
  const { association, clubs, updatedAt } = data;
  if (
    !isEntry(association) ||
    !Array.isArray(clubs) ||
    !clubs.every(isEntry) ||
    typeof updatedAt !== 'number' ||
    !Number.isFinite(updatedAt)
  ) {
    return undefined;
  }
  return {
    association: { id: association.id, name: association.name },
    clubs: clubs.map(entryOf),
    updatedAt,
  };
}

/** The lists of the stored documents `data`, skipping any it cannot read. */
export function parseAssociationClubsList(
  data: readonly unknown[]
): readonly AssociationClubs[] {
  return data
    .map(parseAssociationClubs)
    .filter((list): list is AssociationClubs => list !== undefined);
}

/** What the server reads from the club index. */
export interface StoredClubIndex {
  readonly lists: readonly AssociationClubs[];
  /**
   * Whether every Association the crawl noted holds a list: the index has
   * documents and each one is a list with `OFFERED_ASSOCIATION`'s mark
   * (#3005). A Verband noted before its first crawl, a first crawl still
   * pending, a list stored before the crawl noted Verbände or a document
   * this reader cannot read leaves it incomplete.
   */
  readonly complete: boolean;
}

/** The club index of the stored documents `data`. */
export function parseClubIndex(data: readonly unknown[]): StoredClubIndex {
  return {
    lists: parseAssociationClubsList(data),
    complete:
      data.length > 0 &&
      data.every(
        (document) =>
          isOfferedAssociation(document) &&
          parseAssociationClubs(document) !== undefined
      ),
  };
}

/** Only the fields an entry has, so nothing else reaches the store. */
function entryOf({ id, name, nameFromTeam }: ClubIndexEntry): ClubIndexEntry {
  return nameFromTeam === true ? { id, name, nameFromTeam } : { id, name };
}

function isEntry(value: unknown): value is ClubIndexEntry {
  return (
    isJsonObject(value) &&
    typeof value['id'] === 'number' &&
    isDbbId(value['id']) &&
    typeof value['name'] === 'string' &&
    value['name'].trim() !== '' &&
    (value['nameFromTeam'] === undefined || value['nameFromTeam'] === true)
  );
}
