import type {
  AssociationClubs,
  Association,
  AssociationId,
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
  /**
   * How long an offered Association may go without a list before each run
   * warns of it (#3022): it keeps `/api/clubs` on the short cache.
   */
  readonly warnListlessAfterMs: number;
}

/** An offered Association that has had no list for too long. */
export interface ListlessAssociation {
  readonly association: AssociationId;
  /** The start of its first attempt that found no list, in milliseconds. */
  readonly listlessSince: number;
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
  associations: readonly Association[],
  lists: readonly AssociationClubs[],
  attempts: ReadonlyMap<AssociationId, number>,
  schedule: ClubIndexSchedule,
  now: number
): Association | undefined {
  const listOf = new Map(lists.map((list) => [list.association.id, list]));
  const dueAt = ({ id }: Association): number => {
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

/**
 * The offered Associations without a list whose first attempt that found
 * none (`listlessSince`) lies more than `warnListlessAfterMs` back (#3022),
 * in the order of `associations`. One no attempt has dated yet is not
 * overdue: it is due at once, so dated within a day.
 */
export function overdueListless(
  associations: readonly Association[],
  lists: readonly AssociationClubs[],
  listlessSince: ReadonlyMap<AssociationId, number>,
  schedule: ClubIndexSchedule,
  now: number
): readonly ListlessAssociation[] {
  const listed = new Set(lists.map((list) => list.association.id));
  return associations.flatMap(({ id }) => {
    const since = listlessSince.get(id);
    return !listed.has(id) &&
      since !== undefined &&
      now - since > schedule.warnListlessAfterMs
      ? [{ association: id, listlessSince: since }]
      : [];
  });
}
