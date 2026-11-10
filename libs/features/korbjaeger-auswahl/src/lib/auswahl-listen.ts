import type { TeamId } from '@wolsok/feat-shared-basketball-data';
import { gleicheFolge } from './gleiche-folge';
import type { AuswahlListenArt } from './auswahl-liste';
import type { Kind } from './kind';
import { KINDER, type KindFeld } from './listen/kinder';
import { TEAMS, type TeamFeld } from './listen/teams';
import { VEREINSFARBEN, type VereinsfarbenFeld } from './listen/vereinsfarben';
import type { VereinsfarbenWahl } from './vereinsfarben-wahl';

/**
 * Each list of an `Auswahl`: what an entry is (`wert`), what a change
 * writes of one (`feld`) and the document's field that stores it
 * (`dokument`). A new list gets its entry here, its descriptor in
 * `AUSWAHL_LISTEN_ARTEN`, its cap in `AUSWAHL_GRENZEN` and its rules.
 */
interface ListenTypen {
  readonly teams: {
    readonly wert: TeamId;
    readonly feld: TeamFeld;
    readonly dokument: 'teams';
  };
  readonly kinder: {
    readonly wert: Kind;
    readonly feld: KindFeld;
    readonly dokument: 'children';
  };
  readonly vereinsfarben: {
    readonly wert: VereinsfarbenWahl;
    readonly feld: VereinsfarbenFeld;
    readonly dokument: 'clubColors';
  };
}

/** The lists of an `Auswahl`. */
export type AuswahlListe = keyof ListenTypen;

/** An entry of the list `L`. */
export type ListenWert<L extends AuswahlListe> = ListenTypen[L]['wert'];

/** What a change writes of an entry of the list `L`. */
export type ListenFeld<L extends AuswahlListe> = ListenTypen[L]['feld'];

/** The document's field that stores the list `L`. */
export type ListenDokumentFeld<L extends AuswahlListe> =
  ListenTypen[L]['dokument'];

/** The descriptor of the list `L`. */
export type ListenArt<L extends AuswahlListe> = AuswahlListenArt<
  ListenWert<L>,
  ListenFeld<L>,
  ListenDokumentFeld<L>
>;

/** Every list's descriptor, by the list. */
export const AUSWAHL_LISTEN_ARTEN: {
  readonly [L in AuswahlListe]: ListenArt<L>;
} = { teams: TEAMS, kinder: KINDER, vereinsfarben: VEREINSFARBEN };

/**
 * How many Teams, Kinder and Vereine with colours an `Auswahl` holds at
 * most: the Firestore rules (`firestore.rules`) refuse more, and their spec
 * checks these numbers.
 */
export const AUSWAHL_GRENZEN = {
  teams: 50,
  kinder: 20,
  vereinsfarben: 50,
} as const satisfies Record<AuswahlListe, number>;

/** Every list of an `Auswahl`, in the order a change gives out `seit`s. */
export const AUSWAHL_LISTEN: readonly AuswahlListe[] = [
  'teams',
  'kinder',
  'vereinsfarben',
];

/** The descriptor of `liste`, typed for it. */
export function listenArt<L extends AuswahlListe>(liste: L): ListenArt<L> {
  return AUSWAHL_LISTEN_ARTEN[liste];
}

/** Every list's entries. */
export type AuswahlListen = {
  readonly [L in AuswahlListe]: readonly ListenWert<L>[];
};

/**
 * What an `Auswahl` holds: Meine Teams and the marked Kinder, each once,
 * and the Vereine's colours, one entry a Verein, by its id.
 */
export interface AuswahlInhalt extends AuswahlListen {
  /**
   * Each Team's `seit`, where it is known: as read for a stored Team, as
   * given for one followed at its old place (`folgenAenderung`). A Team
   * without one (followed, not stored yet) counts as the newest.
   */
  readonly teamsSeit?: ReadonlyMap<TeamId, number>;
}

/** An `Auswahl` that holds nothing. */
export const LEERE_AUSWAHL: AuswahlInhalt = {
  teams: [],
  kinder: [],
  vereinsfarben: [],
};

/**
 * One value for each list, from `wert`: the one place the lists are put
 * together. TypeScript cannot check that `wert` gives each list its own
 * type (`T[L]` of a concrete `T` reads as every list's at once), so the
 * cast lives here; `wert` is a generic helper of the list (`listeOhne`),
 * whose own types hold.
 */
export function jedeListe<T extends { readonly [L in AuswahlListe]: unknown }>(
  wert: (liste: AuswahlListe) => unknown
): T {
  return Object.fromEntries(
    AUSWAHL_LISTEN.map((liste) => [liste, wert(liste)])
  ) as T;
}

/** The entries of `liste` in `inhalt` without those `ohneDiese` holds, by id. */
function listeOhne<L extends AuswahlListe>(
  liste: L,
  inhalt: AuswahlListen,
  ohneDiese: AuswahlListen
): readonly ListenWert<L>[] {
  const art: AuswahlListenArt<ListenWert<L>, unknown> = listenArt(liste);
  const ids = new Set(ohneDiese[liste].map((wert) => art.id(wert)));
  return inhalt[liste].filter((wert) => !ids.has(art.id(wert)));
}

/** `inhalt` without the entries of `ohneDiese`, each list by its ids. */
export function auswahlOhne(
  inhalt: AuswahlListen,
  ohneDiese: AuswahlListen
): AuswahlInhalt {
  return jedeListe<AuswahlListen>((liste) =>
    listeOhne(liste, inhalt, ohneDiese)
  );
}

/** The entries of both, each once: `a`'s, then those only `b` holds. */
export function auswahlVereint(
  a: AuswahlListen,
  b: AuswahlListen
): AuswahlInhalt {
  return jedeListe<AuswahlListen>((liste) => [
    ...a[liste],
    ...listeOhne(liste, b, a),
  ]);
}

/** Whether `inhalt` holds nothing in any list. */
export function auswahlLeer(inhalt: AuswahlListen): boolean {
  return AUSWAHL_LISTEN.every((liste) => inhalt[liste].length === 0);
}

/** Whether two lists of `liste` hold equal entries in the same order. */
export function gleicheListe<L extends AuswahlListe>(
  liste: L,
  a: readonly ListenWert<L>[],
  b: readonly ListenWert<L>[]
): boolean {
  const art: AuswahlListenArt<ListenWert<L>, unknown> = listenArt(liste);
  return gleicheFolge(a, b, (x, y) => art.gleich(x, y));
}
