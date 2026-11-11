import type { REMOVED, ReadEntry, RawDocument } from './selection-entries';

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
export interface ListDescriptor<W, F, D extends string> {
  /** The document's field that stores the list, a map by `id`. */
  readonly field: D;
  /** The DBB id the map stores an entry under, which tells entries apart. */
  readonly id: (value: W) => number;
  /** Whether two entries of the same id hold the same. */
  readonly equals: (a: W, b: W) => boolean;
  /**
   * The readable entries of the stored field, in the list's order; an entry
   * it cannot read is left out. `undefined` where the field makes the whole
   * document unreadable. Each entry carries its `since`, unless the list
   * keeps an `order` of its own.
   */
  readonly read: (raw: unknown) => readonly ReadEntry<W>[] | undefined;
  /**
   * What a change writes of an entry that joins; `since` gives its place
   * in a list ordered by when its entries joined: its old one where the
   * change knows it (a Team followed again), else the next. A list with an
   * `order` of its own never calls it.
   */
  readonly added: (value: W, since: () => number) => Exclude<F, typeof REMOVED>;
  /**
   * What a change writes of an entry it changes (same id, not `equals`);
   * a list whose entries are their id alone has none.
   */
  readonly changed?: (previous: W, current: W) => Exclude<F, typeof REMOVED>;
  /** The stored map with `fields` merged into it, as Firestore merges them. */
  readonly merge: (
    stored: RawDocument,
    fields: Readonly<Record<string, F>>
  ) => RawDocument;
  /**
   * An entry both account and device hold, as the account keeps it once
   * they join (`zusammenfuehren`); the account's as it is where absent.
   */
  readonly complete?: (account: W, device: W) => W;
  /**
   * The order the list keeps, where it is not the order entries joined; a
   * list without one is ordered by its entries' `since`.
   */
  readonly order?: (list: readonly W[]) => readonly W[];
}
