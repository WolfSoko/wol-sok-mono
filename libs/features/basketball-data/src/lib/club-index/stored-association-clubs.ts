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
    clubs: list.clubs.map(({ id, name }) => ({ id, name })),
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
  if (!isRecord(data) || data['version'] !== CLUB_INDEX_VERSION) {
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
    clubs: clubs.map(({ id, name }) => ({ id, name })),
    updatedAt,
  };
}

function isEntry(value: unknown): value is ClubIndexEntry {
  return (
    isRecord(value) &&
    typeof value['id'] === 'number' &&
    isDbbId(value['id']) &&
    typeof value['name'] === 'string' &&
    value['name'].trim() !== ''
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
