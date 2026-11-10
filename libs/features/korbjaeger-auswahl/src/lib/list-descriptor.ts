import type { ENTFERNT, ReadEntry, RohesDokument } from './selection-entries';
import type { AuswahlInhalt } from './selection-lists';

/**
 * What tells one list of an `Auswahl` from the others (`LIST_DESCRIPTORS`):
 * how it is stored, read and changed. Everything else that handles a list
 * (diff, merge, joining, takeover, signals) is the same for each, and loops
 * over the table.
 *
 * @typeParam W an entry as the `Auswahl` holds it
 * @typeParam F what a change writes of an entry, `ENTFERNT` where it goes
 * @typeParam D the document's field that stores the list
 */
export interface ListDescriptor<W, F, D extends string = string> {
  /** The document's field that stores the list, a map by `id`. */
  readonly field: D;
  /**
   * Whether its entries are ordered by when they joined, each with a
   * `seit` of its own (Teams, Kinder); one that is not hands out none.
   */
  readonly orderedBySince: boolean;
  /** The DBB id the map stores an entry under, which tells entries apart. */
  readonly id: (value: W) => number;
  /** Whether two entries of the same id hold the same. */
  readonly equals: (a: W, b: W) => boolean;
  /**
   * The readable entries of the stored field, in the list's order; an entry
   * it cannot read is left out. `undefined` where the field makes the whole
   * document unreadable.
   */
  readonly read: (raw: unknown) => readonly ReadEntry<W>[] | undefined;
  /**
   * What a change writes of an entry that joins; `seit` gives it the next
   * place, for a list ordered by when its entries joined.
   */
  readonly added: (
    value: W,
    since: () => number
  ) => Exclude<F, typeof ENTFERNT>;
  /**
   * What a change writes of an entry it changes (same id, not `gleich`);
   * a list whose entries are their id alone has none.
   */
  readonly changed?: (previous: W, current: W) => Exclude<F, typeof ENTFERNT>;
  /** The stored map with `fields` merged into it, as Firestore merges them. */
  readonly merge: (
    stored: RohesDokument,
    fields: Readonly<Record<string, F>>
  ) => RohesDokument;
  /**
   * An entry both account and device hold, as the account keeps it once
   * they join (`zusammenfuehren`); the account's as it is where absent.
   */
  readonly complete?: (account: W, device: W) => W;
  /** The order the list keeps, where it is not the order entries joined. */
  readonly order?: (list: readonly W[]) => readonly W[];
  /** The place `selection` already knows for an entry that joins (`added`). */
  readonly knownSince?: (
    selection: AuswahlInhalt,
    value: W
  ) => number | undefined;
}
