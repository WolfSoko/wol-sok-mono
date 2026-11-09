import type {
  AssociationClubs,
  Verband,
} from '@wolsok/feat-shared-basketball-data';

/**
 * The Association a run crawls: the first in `associations` the index has
 * no list of, else the one whose list is oldest, once it is at least
 * `maxAgeMs` old; `undefined` while every list is fresh.
 */
export function associationToCrawl(
  associations: readonly Verband[],
  stored: readonly AssociationClubs[],
  now: number,
  maxAgeMs: number
): Verband | undefined {
  const updatedAt = new Map(
    stored.map((list) => [list.association.id, list.updatedAt])
  );
  const missing = associations.find(({ id }) => !updatedAt.has(id));
  if (missing !== undefined) {
    return missing;
  }
  const oldest = [...associations].sort(
    (a, b) => (updatedAt.get(a.id) ?? 0) - (updatedAt.get(b.id) ?? 0)
  )[0];
  return oldest !== undefined &&
    now - (updatedAt.get(oldest.id) ?? 0) >= maxAgeMs
    ? oldest
    : undefined;
}
