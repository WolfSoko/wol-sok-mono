import { BasketballDataError } from '../domain/basketball-data-error';
import { isJsonObject } from '../dbb/dbb-object';
import { isDbbId } from '../dbb/dbb-request';
import type { IndexedClub } from './club-index';

/**
 * The club index as `GET /api/clubs` answers it (`IndexedClub[]`), with
 * only the fields a Club has. An entry it cannot read is dropped, so one
 * odd Club hides no other; an answer that is no list at all is
 * `unexpected-shape`.
 */
export function parseIndexedClubs(body: unknown): readonly IndexedClub[] {
  if (!Array.isArray(body)) {
    throw new BasketballDataError(
      'unexpected-shape',
      'club index: the answer is no list'
    );
  }
  return body.filter(isIndexedClub).map(({ id, name, associations }) => ({
    id,
    name,
    associations: associations.map((association) => ({
      id: association.id,
      name: association.name,
    })),
  }));
}

function isIndexedClub(value: unknown): value is IndexedClub {
  return (
    isNamedId(value) &&
    Array.isArray(value['associations']) &&
    value['associations'].every(isNamedId)
  );
}

function isNamedId(
  value: unknown
): value is Record<string, unknown> & { id: number; name: string } {
  return (
    isJsonObject(value) &&
    typeof value['id'] === 'number' &&
    isDbbId(value['id']) &&
    typeof value['name'] === 'string' &&
    value['name'].trim() !== ''
  );
}
