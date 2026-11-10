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
}

/** `list` as the index stores it. */
export function storedAssociationClubs(
  list: AssociationClubs
): StoredAssociationClubs {
  return {
    version: CLUB_INDEX_VERSION,
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
