import {
  ENTFERNT,
  istKarte,
  type ReadEntry,
  type RohesDokument,
} from './selection-entries';
import {
  AUSWAHL_LISTEN,
  everyList,
  listDescriptor,
  type AuswahlInhalt,
  type AuswahlListe,
  type SelectionLists,
  type SinceByList,
  type ListDescriptorOf,
  type ListDocumentField,
  type ListField,
  type ListValue,
} from './selection-lists';

/**
 * The version of `AuswahlDokument` this app writes. Bumped only for a
 * change an older app would misread; a new field is none, since every
 * write keeps the fields it does not know. Version 3 (#2966) names the
 * fields in English and lives under new names (`selections/{uid}`,
 * `korbjaeger-selection`); versions 1 and 2, with the German fields, are
 * read only by the migration (`legacy-selection.ts`), which turns them into
 * this version.
 */
export const AUSWAHL_VERSION = 3;

/**
 * What an adapter stores of an `Auswahl`: ids only, never names from the
 * DBB. Keyed by id, so each change writes its own entries and the server
 * merges them with another device's (a Team followed, a Kind unmarked, a
 * Spitzname changed: none overwrites the other); `since` keeps the order.
 * Each list is a map under its descriptor's field (`LIST_DESCRIPTORS`),
 * whose descriptor tells what an entry holds (`teams: { [teamId]: since }`,
 * `children: { [personId]: { since, nickname? } }`,
 * `clubColors: { [vereinId]: farbenText }`); a missing map holds nothing.
 */
export type AuswahlDokument = {
  readonly version: typeof AUSWAHL_VERSION;
} & {
  readonly [L in AuswahlListe as ListDocumentField<L>]?: RohesDokument;
};

/**
 * The place a Team had among Meine Teams, which `Auswahl.entfolgen` hands
 * out so an undo can follow it there again; only an adapter makes one.
 */
export interface TeamPlatz {
  /** The Team's `seit`, which orders Meine Teams. */
  readonly seit: number;
}

/**
 * What a stored document turned out to be:
 * - `aktuell`: this version's, with its fields as read (`roh`), which a
 *   write keeps, and the latest `seit` it holds.
 * - `neuer`: a newer version's, which this version leaves alone.
 * - `keins`: nothing, or something that is no `AuswahlDokument`.
 */
export type GelesenesDokument =
  | ({
      readonly art: 'aktuell';
      readonly roh: RohesDokument;
      readonly hoechsterSeit: number;
    } & AuswahlInhalt)
  | { readonly art: 'neuer' }
  | { readonly art: 'keins' };

const KEINS: GelesenesDokument = { art: 'keins' };

/** Every list's entries as read, with their `seit`. */
type ReadLists = {
  readonly [L in AuswahlListe]: readonly ReadEntry<ListValue<L>>[];
};

/**
 * Tells what `gelesen`, a stored document, is: each list as its
 * descriptor reads it (Teams that are not all ids make it none; an entry of
 * the other lists it cannot read is left out, the rest kept). A document of
 * another version than this one is none, of a newer one `neuer`.
 */
export function auswahlDokumentLesen(gelesen: unknown): GelesenesDokument {
  if (!istKarte(gelesen)) {
    return KEINS;
  }
  const { version } = gelesen;
  if (typeof version === 'number' && version > AUSWAHL_VERSION) {
    return { art: 'neuer' };
  }
  const lists = version === AUSWAHL_VERSION ? readLists(gelesen) : undefined;
  if (lists === undefined) {
    return KEINS;
  }
  const since = sinceRead(lists);
  return {
    art: 'aktuell',
    ...everyList<SelectionLists>((list) =>
      lists[list].map(({ value }) => value)
    ),
    since,
    hoechsterSeit: Math.max(
      0,
      ...Object.values(since).flatMap((known) => [...known.values()])
    ),
    roh: gelesen,
  };
}

/** Each read entry's `since` by its id, for the lists whose entries carry one. */
function sinceRead(lists: ReadLists): SinceByList {
  const since: { [L in AuswahlListe]?: ReadonlyMap<number, number> } = {};
  for (const list of AUSWAHL_LISTEN) {
    const { id } = listDescriptor(list);
    const known = new Map<number, number>();
    for (const entry of lists[list]) {
      if (entry.since !== undefined) {
        known.set(id(entry.value), entry.since);
      }
    }
    if (known.size > 0) {
      since[list] = known;
    }
  }
  return since;
}

/** Each list of `document`; `undefined` where one makes it unreadable. */
function readLists(document: RohesDokument): ReadLists | undefined {
  const lists = everyList<{
    readonly [L in AuswahlListe]: ReadLists[L] | undefined;
  }>((list) => {
    const descriptor = listDescriptor(list);
    return descriptor.read(document[descriptor.field]);
  });
  // every list read: the type of each is its own
  return AUSWAHL_LISTEN.every((list) => lists[list] !== undefined)
    ? (lists as ReadLists)
    : undefined;
}

/**
 * The `seit` a change gives its new entries: now, but always after every
 * entry it knows and every one it gave before (`letzter`), so the order of
 * two changes within a millisecond holds.
 */
export function naechsterSeit(gelesen: GelesenesDokument, letzter = 0): number {
  return Math.max(
    Date.now(),
    (gelesen.art === 'aktuell' ? gelesen.hoechsterSeit : 0) + 1,
    letzter + 1
  );
}

/** The entries a change writes of the list `L`, by id. */
type ListFields<L extends AuswahlListe> = Readonly<
  Record<string, ListField<L>>
>;

/**
 * The entries a change writes, by id, under each list's document field; a
 * map it does not change is left out, so a write keeps it as stored
 * (entries this version cannot read too).
 */
export type AuswahlFelder = {
  readonly [L in AuswahlListe as ListDocumentField<L>]?: ListFields<L>;
};

/** The entries `fields` writes of `list`; none where it leaves it out. */
export function listFields<L extends AuswahlListe>(
  fields: AuswahlFelder,
  list: L
): ListFields<L> | undefined {
  const byField: Readonly<Record<string, ListFields<L> | undefined>> = fields;
  return byField[listDescriptor(list).field];
}

/**
 * What a change writes (`selectionWrite`): its entries (`fields`), the
 * `since` it wrote for each entry that joins a list ordered by since, given
 * out or known (`since`), and the last one it gave out (`lastSince`, one
 * before the first where it gave out none), which an adapter's next change
 * starts after.
 */
export interface SelectionWrite {
  readonly fields: AuswahlFelder;
  readonly since: SinceByList;
  readonly lastSince: number;
}

/**
 * The entries that take `before` to `after` (`selectionWrite`), for a
 * writer that needs no more of it.
 */
export function auswahlFelder(
  before: AuswahlInhalt,
  after: AuswahlInhalt,
  firstSince: number
): AuswahlFelder {
  return selectionWrite(before, after, firstSince).fields;
}

/**
 * The entries that take `before` to `after`, list by list in
 * `AUSWAHL_LISTEN`'s order: those gone, the new ones (at the `since`
 * `after` knows for one, a Team followed at its old place; else from
 * `firstSince`, one millisecond each, in their order) and the ones changed
 * (a Spitzname, colours). Every adapter writes them: the device's merged
 * into its document (`auswahlDokumentMit`), Firestore as fields the server
 * merges.
 */
export function selectionWrite(
  before: AuswahlInhalt,
  after: AuswahlInhalt,
  firstSince: number
): SelectionWrite {
  let next = firstSince;
  const fields: Record<string, unknown> = {};
  const since: { [L in AuswahlListe]?: ReadonlyMap<number, number> } = {};
  for (const list of AUSWAHL_LISTEN) {
    const written = new Map<number, number>();
    const sinceFor = (id: number) => (): number => {
      const given = after.since?.[list]?.get(id) ?? next++;
      written.set(id, given);
      return given;
    };
    const entries = fieldsOf(list, before, after, sinceFor);
    if (Object.keys(entries).length > 0) {
      fields[listDescriptor(list).field] = entries;
    }
    if (written.size > 0) {
      since[list] = written;
    }
  }
  // each list's entries under its own field, as `AuswahlFelder` has them
  return { fields: fields as AuswahlFelder, since, lastSince: next - 1 };
}

/** What `selectionWrite` writes of `list`; `sinceFor` gives an entry its `since`. */
function fieldsOf<L extends AuswahlListe>(
  list: L,
  before: AuswahlInhalt,
  after: AuswahlInhalt,
  sinceFor: (id: number) => () => number
): ListFields<L> {
  const fields: Record<string, ListField<L> | typeof ENTFERNT> = {};
  if (before[list] === after[list]) {
    // a list the change leaves alone writes nothing
    return fields;
  }
  const descriptor: ListDescriptorOf<L> = listDescriptor(list);
  const earlier = new Map(
    before[list].map((value) => [descriptor.id(value), value])
  );
  const gone = new Set(earlier.keys());
  for (const value of after[list]) {
    const id = descriptor.id(value);
    const previous = earlier.get(id);
    gone.delete(id);
    if (previous === undefined) {
      fields[id] = descriptor.added(value, sinceFor(id));
    } else if (!descriptor.equals(previous, value) && descriptor.changed) {
      fields[id] = descriptor.changed(previous, value);
    }
  }
  for (const id of gone) {
    fields[id] = ENTFERNT;
  }
  // every list's `field` type takes `ENTFERNT`
  return fields as ListFields<L>;
}

/**
 * The document to store: `gelesen`'s fields with this version and `felder`
 * merged into its maps, each by its list's descriptor, as Firestore merges
 * them. A map a change leaves out stays as read.
 */
export function auswahlDokumentMit(
  gelesen: GelesenesDokument,
  fields: AuswahlFelder
): RohesDokument {
  const raw = gelesen.art === 'aktuell' ? gelesen.roh : {};
  const document: Record<string, unknown> = {
    ...raw,
    version: AUSWAHL_VERSION,
  };
  for (const list of AUSWAHL_LISTEN) {
    const entries = listFields(fields, list);
    if (entries !== undefined) {
      const descriptor: ListDescriptorOf<typeof list> = listDescriptor(list);
      const stored = raw[descriptor.field];
      document[descriptor.field] = descriptor.merge(
        istKarte(stored) ? stored : {},
        entries
      );
    }
  }
  return document;
}
