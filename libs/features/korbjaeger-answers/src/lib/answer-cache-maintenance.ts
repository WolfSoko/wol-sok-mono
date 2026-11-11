import type { DbbRequestKind } from '@wolsok/feat-shared-basketball-data';
import type { LocalAnswerCache } from './answer-cache';

/** How often an open page clears answers too old: hourly. */
export const MAINTENANCE_INTERVAL_MS = 60 * 60_000;

/** The part of the page the upkeep listens to. */
export type MaintenancePage = Pick<
  Document,
  'visibilityState' | 'addEventListener' | 'removeEventListener'
>;

/** What `antwortenPflegen` keeps clear, and where it listens. */
export interface MaintenanceOptions {
  /** The page whose return into view clears too. */
  readonly document: MaintenancePage;
  /** The kinds of read still kept; answers of any other kind go. */
  readonly kinds: ReadonlySet<DbbRequestKind>;
}

/**
 * Keeps `antworten` clear of answers too old and of kinds no longer kept
 * (`aufraeumen`): at once, whenever the page comes back into view, and
 * every `PFLEGE_TAKT_MS` while it stays open. Returns what stops it.
 */
export function maintainAnswerCache(
  cache: Pick<LocalAnswerCache, 'cleanUp'>,
  { document, kinds }: MaintenanceOptions
): () => void {
  const cleanUp = (): void => cache.cleanUp(Date.now(), kinds);
  const onVisible = (): void => {
    if (document.visibilityState === 'visible') {
      cleanUp();
    }
  };
  cleanUp();
  document.addEventListener('visibilitychange', onVisible);
  const interval = setInterval(cleanUp, MAINTENANCE_INTERVAL_MS);
  return () => {
    document.removeEventListener('visibilitychange', onVisible);
    clearInterval(interval);
  };
}
