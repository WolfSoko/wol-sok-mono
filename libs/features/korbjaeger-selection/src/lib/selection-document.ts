import {
  REMOVED,
  isMap,
  type ReadEntry,
  type RawDocument,
} from './selection-entries';
import {
  SELECTION_LISTS,
  everyList,
  listDescriptor,
  type SelectionContent,
  type SelectionList,
  type SelectionLists,
  type SinceByList,
  type ListDescriptorOf,
  type ListDocumentField,
  type ListField,
  type ListValue,
} from './selection-lists';

/**
 * The version of `SelectionDocument` this app writes. Bumped only for a
 * change an older app would misread; a new field is none, since every
 * write keeps the fields it does not know. Version 3 (#2966) names the
 * fields in English and lives under new names (`selections/{uid}`,
 * `korbjaeger-selection`); versions 1 and 2, with the German fields, are
 * read only by the migration (`legacy-selection.ts`), which turns them into
 * this version.
 */
export const SELECTION_VERSION = 3;

/**
 * What an adapter stores of a `Selection`: ids only, never names from the
 * DBB. Keyed by id, so each change writes its own entries and the server
 * merges them with another device's (a Team followed, a Kind unmarked, a
 * Spitzname changed: none overwrites the other); `since` keeps the order.
 * Each list is a map under its descriptor's field (`LIST_DESCRIPTORS`),
 * whose descriptor tells what an entry holds (`teams: { [teamId]: since }`,
 * `children: { [personId]: { since, nickname? } }`,
 * `clubColors: { [clubId]: colorsText }`); a missing map holds nothing.
 */
export type SelectionDocument = {
  readonly version: typeof SELECTION_VERSION;
} & {
  readonly [L in SelectionList as ListDocumentField<L>]?: RawDocument;
};

/**
 * The place a Team had among Meine Teams, which `Selection.unfollow` hands
 * out so an undo can follow it there again; only an adapter makes one.
 */
export interface TeamPlace {
  /** The Team's `since`, which orders Meine Teams. */
  readonly since: number;
}

/**
 * What a stored document turned out to be:
 * - `current`: this version's, with its fields as read (`raw`), which a
 *   write keeps, and the latest `since` it holds.
 * - `newer`: a newer version's, which this version leaves alone.
 * - `none`: nothing, or something that is no `SelectionDocument`.
 */
export type ReadDocument =
  | ({
      readonly kind: 'current';
      readonly raw: RawDocument;
      readonly latestSince: number;
    } & SelectionContent)
  | { readonly kind: 'newer' }
  | { readonly kind: 'none' };

const NONE: ReadDocument = { kind: 'none' };

/** Every list's entries as read, with their `since`. */
type ReadLists = {
  readonly [L in SelectionList]: readonly ReadEntry<ListValue<L>>[];
};

/**
 * Tells what `read`, a stored document, is: each list as its
 * descriptor reads it (Teams that are not all ids make it none; an entry of
 * the other lists it cannot read is left out, the rest kept). A document of
 * another version than this one is none, of a newer one `newer`.
 */
export function readSelectionDocument(read: unknown): ReadDocument {
  if (!isMap(read)) {
    return NONE;
  }
  const { version } = read;
  if (typeof version === 'number' && version > SELECTION_VERSION) {
    return { kind: 'newer' };
  }
  const lists = version === SELECTION_VERSION ? readLists(read) : undefined;
  if (lists === undefined) {
    return NONE;
  }
  const since = sinceRead(lists);
  return {
    kind: 'current',
    ...everyList<SelectionLists>((list) =>
      lists[list].map(({ value }) => value)
    ),
    since,
    latestSince: Math.max(
      0,
      ...Object.values(since).flatMap((known) => [...known.values()])
    ),
    raw: read,
  };
}

/** Each read entry's `since` by its id, for the lists whose entries carry one. */
function sinceRead(lists: ReadLists): SinceByList {
  const since: { [L in SelectionList]?: ReadonlyMap<number, number> } = {};
  for (const list of SELECTION_LISTS) {
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
function readLists(document: RawDocument): ReadLists | undefined {
  const lists = everyList<{
    readonly [L in SelectionList]: ReadLists[L] | undefined;
  }>((list) => {
    const descriptor = listDescriptor(list);
    return descriptor.read(document[descriptor.field]);
  });
  // every list read: the type of each is its own
  return SELECTION_LISTS.every((list) => lists[list] !== undefined)
    ? (lists as ReadLists)
    : undefined;
}

/**
 * The `since` a change gives its new entries: now, but always after every
 * entry it knows and every one it gave before (`last`), so the order of
 * two changes within a millisecond holds.
 */
export function nextSince(read: ReadDocument, last = 0): number {
  return Math.max(
    Date.now(),
    (read.kind === 'current' ? read.latestSince : 0) + 1,
    last + 1
  );
}

/** The entries a change writes of the list `L`, by id. */
type ListFields<L extends SelectionList> = Readonly<
  Record<string, ListField<L>>
>;

/**
 * The entries a change writes, by id, under each list's document field; a
 * map it does not change is left out, so a write keeps it as stored
 * (entries this version cannot read too).
 */
export type SelectionFields = {
  readonly [L in SelectionList as ListDocumentField<L>]?: ListFields<L>;
};

/** The entries `fields` writes of `list`; none where it leaves it out. */
export function listFields<L extends SelectionList>(
  fields: SelectionFields,
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
  readonly fields: SelectionFields;
  readonly since: SinceByList;
  readonly lastSince: number;
}

/**
 * The entries that take `before` to `after` (`selectionWrite`), for a
 * writer that needs no more of it.
 */
export function selectionFields(
  before: SelectionContent,
  after: SelectionContent,
  firstSince: number
): SelectionFields {
  return selectionWrite(before, after, firstSince).fields;
}

/**
 * The entries that take `before` to `after`, list by list in
 * `SELECTION_LISTS`'s order: those gone, the new ones (at the `since`
 * `after` knows for one, a Team followed at its old place; else from
 * `firstSince`, one millisecond each, in their order) and the ones changed
 * (a Spitzname, colours). Every adapter writes them: the device's merged
 * into its document (`selectionDocumentWith`), Firestore as fields the server
 * merges.
 */
export function selectionWrite(
  before: SelectionContent,
  after: SelectionContent,
  firstSince: number
): SelectionWrite {
  let next = firstSince;
  const fields: Record<string, unknown> = {};
  const since: { [L in SelectionList]?: ReadonlyMap<number, number> } = {};
  for (const list of SELECTION_LISTS) {
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
  // each list's entries under its own field, as `SelectionFields` has them
  return { fields: fields as SelectionFields, since, lastSince: next - 1 };
}

/** What `selectionWrite` writes of `list`; `sinceFor` gives an entry its `since`. */
function fieldsOf<L extends SelectionList>(
  list: L,
  before: SelectionContent,
  after: SelectionContent,
  sinceFor: (id: number) => () => number
): ListFields<L> {
  const fields: Record<string, ListField<L> | typeof REMOVED> = {};
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
    fields[id] = REMOVED;
  }
  // every list's `field` type takes `REMOVED`
  return fields as ListFields<L>;
}

/**
 * The document to store: `read`'s fields with this version and `fields`
 * merged into its maps, each by its list's descriptor, as Firestore merges
 * them. A map a change leaves out stays as read.
 */
export function selectionDocumentWith(
  read: ReadDocument,
  fields: SelectionFields
): RawDocument {
  const raw = read.kind === 'current' ? read.raw : {};
  const document: Record<string, unknown> = {
    ...raw,
    version: SELECTION_VERSION,
  };
  for (const list of SELECTION_LISTS) {
    const entries = listFields(fields, list);
    if (entries !== undefined) {
      const descriptor: ListDescriptorOf<typeof list> = listDescriptor(list);
      const stored = raw[descriptor.field];
      document[descriptor.field] = descriptor.merge(
        isMap(stored) ? stored : {},
        entries
      );
    }
  }
  return document;
}
