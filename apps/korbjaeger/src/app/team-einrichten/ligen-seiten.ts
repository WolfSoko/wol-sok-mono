import {
  computed,
  inject,
  Injector,
  linkedSignal,
  type Signal,
} from '@angular/core';
import {
  naechsterStartIndex,
  type Liga,
  type LigaSeite,
  type LigaSucheFilter,
} from '@wolsok/feat-shared-basketball-data';
import { BASKETBALL_DATA } from '../basketball-data/basketball-data.provider';
import { ligaSucheResource } from '../basketball-data/liga-suche-resource';

/** The Ligen a filter finds, page by page. */
export interface LigenSeiten {
  /** The Ligen of every page read so far, in the DBB's order. */
  readonly ligen: Signal<readonly Liga[]>;
  /** Whether a page is being read. */
  readonly laedt: Signal<boolean>;
  /** Whether a page after the last one read exists. */
  readonly weitere: Signal<boolean>;
  /** Why the last read failed; none while it did not. */
  readonly fehler: Signal<unknown>;
  /** Reads the next page, if there is one and none is being read. */
  mehr(): Promise<void>;
}

/** What is read of the pages after the first, for one filter. */
interface FolgeSeiten {
  readonly seiten: readonly LigaSeite[];
  readonly laedt: boolean;
  readonly fehler: unknown;
}

const KEINE_FOLGESEITEN: FolgeSeiten = {
  seiten: [],
  laedt: false,
  fehler: undefined,
};

/**
 * The Ligen of the filter `filter` gives: the first page with the search,
 * every later one through the DBB's list call on `mehr()`. A new filter
 * starts over; a page still read for the last is dropped. Created in an
 * injection context, or on `injector`.
 */
export function ligenSeiten(
  filter: () => LigaSucheFilter | undefined,
  injector: Injector = inject(Injector)
): LigenSeiten {
  const data = injector.get(BASKETBALL_DATA);
  const suche = ligaSucheResource(filter, injector);
  const aktuellerFilter = computed(filter);
  const folgende = linkedSignal<LigaSucheFilter | undefined, FolgeSeiten>({
    source: aktuellerFilter,
    computation: () => KEINE_FOLGESEITEN,
  });

  const seiten = computed((): readonly LigaSeite[] =>
    suche.hasValue() ? [suche.value().ersteSeite, ...folgende().seiten] : []
  );
  const naechsterStart = computed(() => {
    const letzte = seiten().at(-1);
    return letzte === undefined ? undefined : naechsterStartIndex(letzte);
  });

  /** Applies `aenderung` while `fuer` is still the filter. */
  const solangeAktuell = (
    fuer: LigaSucheFilter,
    aenderung: (bisher: FolgeSeiten) => FolgeSeiten
  ): void => {
    if (aktuellerFilter() === fuer) {
      folgende.update(aenderung);
    }
  };

  return {
    ligen: computed(() => seiten().flatMap((seite) => seite.ligen)),
    laedt: computed(() => suche.isLoading() || folgende().laedt),
    weitere: computed(() => naechsterStart() !== undefined),
    fehler: computed(() => suche.error() ?? folgende().fehler),
    mehr: async () => {
      const fuer = aktuellerFilter();
      const start = naechsterStart();
      if (fuer === undefined || start === undefined || folgende().laedt) {
        return;
      }
      solangeAktuell(fuer, (bisher) => ({
        ...bisher,
        laedt: true,
        fehler: undefined,
      }));
      try {
        const seite = await data.ligaSeite(fuer, start);
        solangeAktuell(fuer, (bisher) => ({
          seiten: [...bisher.seiten, seite],
          laedt: false,
          fehler: undefined,
        }));
      } catch (fehler: unknown) {
        solangeAktuell(fuer, (bisher) => ({ ...bisher, laedt: false, fehler }));
      }
    },
  };
}
