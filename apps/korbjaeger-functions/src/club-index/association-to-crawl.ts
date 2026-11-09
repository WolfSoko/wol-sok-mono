import type {
  AssociationClubs,
  Verband,
  VerbandId,
} from '@wolsok/feat-shared-basketball-data';

/** When the club index crawls an Association. */
export interface ClubIndexSchedule {
  /** How old a list may grow before its Association is crawled again. */
  readonly maxAgeMs: number;
  /**
   * How long after a crawl that left no list it is tried again, and how
   * old a list may grow that a Team's name stands in for a Club's in.
   */
  readonly retryAfterMs: number;
  /** How long into a crawl Clubs' names are still read. */
  readonly namesForMs: number;
}

/**
 * The Association a run crawls: the one due first, `undefined` while none
 * is due. One without a list is due at once, one with a list once that is
 * `maxAgeMs` old (`retryAfterMs`, where a Team's name stands in for a
 * Club's, so the next crawl reads the missing names soon); a crawl started after its list (`attempts`) that left
 * none (it failed or ran out of time) makes it due only `retryAfterMs`
 * after that start, so one failing Association never holds up the others.
 * Equally due ones go in the order of `associations`.
 */
export function associationToCrawl(
  associations: readonly Verband[],
  lists: readonly AssociationClubs[],
  attempts: ReadonlyMap<VerbandId, number>,
  schedule: ClubIndexSchedule,
  now: number
): Verband | undefined {
  const listOf = new Map(lists.map((list) => [list.association.id, list]));
  const dueAt = ({ id }: Verband): number => {
    const list = listOf.get(id);
    const updated = list?.updatedAt;
    const due =
      list === undefined
        ? 0
        : list.updatedAt +
          (list.clubs.some(({ nameFromTeam }) => nameFromTeam)
            ? schedule.retryAfterMs
            : schedule.maxAgeMs);
    const attempt = attempts.get(id);
    return attempt !== undefined && attempt > (updated ?? -Infinity)
      ? Math.max(due, attempt + schedule.retryAfterMs)
      : due;
  };
  const [first] = associations
    .map((association) => ({ association, due: dueAt(association) }))
    .filter(({ due }) => due <= now)
    .sort((a, b) => a.due - b.due);
  return first?.association;
}
