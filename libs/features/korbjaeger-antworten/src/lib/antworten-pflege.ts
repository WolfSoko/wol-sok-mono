import type { DbbRequestKind } from '@wolsok/feat-shared-basketball-data';
import type { LokaleLetzteAntworten } from './letzte-antworten';

/** How often an open page clears answers too old: hourly. */
export const PFLEGE_TAKT_MS = 60 * 60_000;

/** The part of the page the upkeep listens to. */
export type PflegeSeite = Pick<
  Document,
  'visibilityState' | 'addEventListener' | 'removeEventListener'
>;

/** What `antwortenPflegen` keeps clear, and where it listens. */
export interface PflegeOptionen {
  /** The page whose return into view clears too. */
  readonly document: PflegeSeite;
  /** The kinds of read still kept; answers of any other kind go. */
  readonly arten: ReadonlySet<DbbRequestKind>;
}

/**
 * Keeps `antworten` clear of answers too old and of kinds no longer kept
 * (`aufraeumen`): at once, whenever the page comes back into view, and
 * every `PFLEGE_TAKT_MS` while it stays open. Returns what stops it.
 */
export function antwortenPflegen(
  antworten: Pick<LokaleLetzteAntworten, 'aufraeumen'>,
  { document, arten }: PflegeOptionen
): () => void {
  const aufraeumen = (): void => antworten.aufraeumen(Date.now(), arten);
  const beiSichtbar = (): void => {
    if (document.visibilityState === 'visible') {
      aufraeumen();
    }
  };
  aufraeumen();
  document.addEventListener('visibilitychange', beiSichtbar);
  const takt = setInterval(aufraeumen, PFLEGE_TAKT_MS);
  return () => {
    document.removeEventListener('visibilitychange', beiSichtbar);
    clearInterval(takt);
  };
}
