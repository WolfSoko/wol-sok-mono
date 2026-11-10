import type {
  ENTFERNT,
  GelesenerEintrag,
  RohesDokument,
} from './auswahl-eintraege';
import type { AuswahlInhalt } from './auswahl-listen';

/**
 * What tells one list of an `Auswahl` from the others (`AUSWAHL_LISTEN_ARTEN`):
 * how it is stored, read and changed. Everything else that handles a list
 * (diff, merge, joining, takeover, signals) is the same for each, and loops
 * over the table.
 *
 * @typeParam W an entry as the `Auswahl` holds it
 * @typeParam F what a change writes of an entry, `ENTFERNT` where it goes
 * @typeParam D the document's field that stores the list
 */
export interface AuswahlListenArt<W, F, D extends string = string> {
  /** The document's field that stores the list, a map by `id`. */
  readonly feld: D;
  /** The DBB id the map stores an entry under, which tells entries apart. */
  id(wert: W): number;
  /** Whether two entries of the same id hold the same. */
  gleich(a: W, b: W): boolean;
  /**
   * The readable entries of the stored field, in the list's order; an entry
   * it cannot read is left out. `undefined` where the field makes the whole
   * document unreadable.
   */
  lesen(roh: unknown): readonly GelesenerEintrag<W>[] | undefined;
  /**
   * What a change writes of an entry that joins; `seit` gives it the next
   * place, for a list ordered by when its entries joined.
   */
  neu(wert: W, seit: () => number): Exclude<F, typeof ENTFERNT>;
  /**
   * What a change writes of an entry it changes (same id, not `gleich`);
   * a list whose entries are their id alone has none.
   */
  geaendert?(alt: W, neu: W): Exclude<F, typeof ENTFERNT>;
  /** The stored map with `felder` merged into it, as Firestore merges them. */
  mit(
    gespeichert: RohesDokument,
    felder: Readonly<Record<string, F>>
  ): RohesDokument;
  /**
   * An entry both account and device hold, as the account keeps it once
   * they join (`zusammenfuehren`); the account's as it is where absent.
   */
  ergaenzen?(konto: W, geraet: W): W;
  /** The order the list keeps, where it is not the order entries joined. */
  ordnen?(liste: readonly W[]): readonly W[];
  /** The place `inhalt` already knows for an entry that joins (`neu`). */
  bekannterSeit?(inhalt: AuswahlInhalt, wert: W): number | undefined;
}
