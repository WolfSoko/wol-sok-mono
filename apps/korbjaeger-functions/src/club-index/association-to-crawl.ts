import type {
  AssociationClubs,
  Verband,
  VerbandId,
} from '@wolsok/feat-shared-basketball-data';

/** How a run decides which Association it crawls. */
export interface CrawlSchedule {
  readonly now: number;
  /** How old a list may grow before its Association is crawled again. */
  readonly maxAgeMs: number;
  /** How long after a crawl that left no list it is tried again. */
  readonly retryAfterMs: number;
}

/**
 * The Association a run crawls: the one due first, `undefined` while none
 * is due. One without a list is due at once, one with a list once that is
 * `maxAgeMs` old; a crawl started after its list (`attempts`) that left
 * none (it failed or ran out of time) makes it due only `retryAfterMs`
 * after that start, so one failing Association never holds up the others.
 * Equally due ones go in the order of `associations`.
 */
export function associationToCrawl(
  associations: readonly Verband[],
  lists: readonly AssociationClubs[],
  attempts: ReadonlyMap<VerbandId, number>,
  schedule: CrawlSchedule
): Verband | undefined {
  const updatedAt = new Map(
    lists.map((list) => [list.association.id, list.updatedAt])
  );
  const dueAt = ({ id }: Verband): number => {
    const updated = updatedAt.get(id);
    const due = updated === undefined ? 0 : updated + schedule.maxAgeMs;
    const attempt = attempts.get(id);
    return attempt !== undefined && attempt > (updated ?? -Infinity)
      ? Math.max(due, attempt + schedule.retryAfterMs)
      : due;
  };
  const [first] = associations
    .map((association) => ({ association, due: dueAt(association) }))
    .filter(({ due }) => due <= schedule.now)
    .sort((a, b) => a.due - b.due);
  return first?.association;
}
