import type { Verband } from '../domain/verband';
import { isJsonObject } from '../dbb/dbb-object';
import { isDbbId } from '../dbb/dbb-request';
import type { IndexedClub } from './club-index';

/**
 * The index the club route (`/api/clubs`) answers with, as the device reads
 * it, or `undefined` for a body of any other shape: a device searches the
 * whole index or none of it. Keeps only the fields it knows.
 */
export function parseIndexedClubs(
  body: unknown
): readonly IndexedClub[] | undefined {
  if (!Array.isArray(body) || !body.every(isIndexedClub)) {
    return undefined;
  }
  return body.map(({ id, name, associations }) => ({
    id,
    name,
    associations: associations.map(({ id: verband, name: verbandName }) => ({
      id: verband,
      name: verbandName,
    })),
  }));
}

function isIndexedClub(value: unknown): value is IndexedClub {
  return (
    isNamed(value) &&
    Array.isArray(value['associations']) &&
    value['associations'].every(isNamed)
  );
}

/** An object with a DBB id and a name, as a Club and a `Verband` have. */
function isNamed(
  value: unknown
): value is Verband & Readonly<Record<string, unknown>> {
  return (
    isJsonObject(value) &&
    typeof value['id'] === 'number' &&
    isDbbId(value['id']) &&
    typeof value['name'] === 'string' &&
    value['name'].trim() !== ''
  );
}
