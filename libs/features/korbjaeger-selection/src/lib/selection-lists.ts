import { sameSequence } from './same-sequence';
import type { ListDescriptor } from './list-descriptor';
import { CHILDREN } from './lists/children';
import { TEAMS } from './lists/teams';
import { CLUB_COLORS } from './lists/club-colors';
import { compareBySince } from './selection-entries';

/**
 * Every list's descriptor, by the list: what an entry is, what a change
 * writes of one and the document's field that stores it, each taken from
 * here (`ListValue`, `ListField`, `ListDocumentField`). A new list gets its
 * descriptor here, its cap in `SELECTION_LIMITS` and its rules.
 */
const DESCRIPTORS = {
  teams: TEAMS,
  children: CHILDREN,
  clubColors: CLUB_COLORS,
} as const;

/** The lists of a `Selection`. */
export type SelectionList = keyof typeof DESCRIPTORS;

/**
 * The types of a descriptor: what an entry is, what a change writes of one
 * and the document's field that stores the list.
 */
type DescriptorTypes<T> =
  T extends ListDescriptor<infer W, infer F, infer D>
    ? { readonly value: W; readonly field: F; readonly document: D }
    : never;

/**
 * Each list's types, read off its descriptor once per list, so a generic
 * list's types stay indexed (`ListValue<L>`) rather than conditional.
 */
type TypesByList = {
  readonly [L in SelectionList]: DescriptorTypes<(typeof DESCRIPTORS)[L]>;
};

/** An entry of the list `L`. */
export type ListValue<L extends SelectionList> = TypesByList[L]['value'];

/** What a change writes of an entry of the list `L`. */
export type ListField<L extends SelectionList> = TypesByList[L]['field'];

/** The document's field that stores the list `L`. */
export type ListDocumentField<L extends SelectionList> =
  TypesByList[L]['document'];

/** The descriptor of the list `L`. */
export type ListDescriptorOf<L extends SelectionList> = ListDescriptor<
  ListValue<L>,
  ListField<L>,
  ListDocumentField<L>
>;

/**
 * The table with each list's descriptor typed for it: checked list by list
 * against the types read off it, so a descriptor they misread fails here.
 */
export const LIST_DESCRIPTORS: {
  readonly [L in SelectionList]: ListDescriptorOf<L>;
} = DESCRIPTORS;

/**
 * How many Teams, Kinder and Vereine with colours a `Selection` holds at
 * most: the Firestore rules (`firestore.rules`) refuse more, and their spec
 * checks these numbers.
 */
export const SELECTION_LIMITS = {
  teams: 50,
  children: 20,
  clubColors: 50,
} as const satisfies Record<SelectionList, number>;

/**
 * Every list of a `Selection`, in `LIST_DESCRIPTORS`' order, which is the
 * order a change gives out `since` values; taken from the table, so a list
 * it holds is never left out of a loop.
 */
export const SELECTION_LISTS = Object.keys(
  LIST_DESCRIPTORS
) as readonly SelectionList[];

/** The descriptor of `list`, typed for it. */
export function listDescriptor<L extends SelectionList>(
  list: L
): ListDescriptorOf<L> {
  return LIST_DESCRIPTORS[list];
}

/** Every list's entries. */
export type SelectionLists = {
  readonly [L in SelectionList]: readonly ListValue<L>[];
};

/**
 * What a `Selection` holds: Meine Teams and the marked Kinder, each once,
 * and the Vereine's colours, one entry a Verein, by its id.
 */
export interface SelectionContent extends SelectionLists {
  /**
   * Each entry's `since` by its id, list by list, where it is known: as
   * read for a stored entry, as written for one a change just added, as
   * given for one put back at its old place (`withEntryAt`). An entry
   * without one (added, not stored yet) counts as the newest; a list with
   * an `order` of its own has none.
   */
  readonly since?: SinceByList;
}

/** Each entry's `since` by its id, for the lists that know one. */
export type SinceByList = {
  readonly [L in SelectionList]?: ReadonlyMap<number, number>;
};

/** A `Selection` that holds nothing. */
export const EMPTY_SELECTION: SelectionContent = everyList<SelectionLists>(
  () => []
);

/**
 * One value for each list, from `value`: the one place the lists are put
 * together. TypeScript cannot check that `value` gives each list its own
 * type (`T[L]` of a concrete `T` reads as every list's at once), so the
 * cast lives here; `value` is a generic helper of the list (`listWithout`),
 * whose own types hold.
 */
export function everyList<T extends { readonly [L in SelectionList]: unknown }>(
  value: (list: SelectionList) => unknown
): T {
  return Object.fromEntries(
    SELECTION_LISTS.map((list) => [list, value(list)])
  ) as T;
}

/**
 * The entries of `list` in `selection` without those `without` holds: by
 * id, or, with `byEquals`, only those equal in all they hold (a Kind with
 * another Spitzname stays).
 */
export function listWithout<L extends SelectionList>(
  list: L,
  selection: SelectionLists,
  without: SelectionLists,
  byEquals = false
): readonly ListValue<L>[] {
  const descriptor: ListDescriptorOf<L> = listDescriptor(list);
  const byId = new Map(
    without[list].map((value) => [descriptor.id(value), value])
  );
  return selection[list].filter((value) => {
    const other = byId.get(descriptor.id(value));
    return (
      other === undefined || (byEquals && !descriptor.equals(other, value))
    );
  });
}

/** `selection` without the entries of `without`, each list by its ids. */
export function selectionWithout(
  selection: SelectionLists,
  without: SelectionLists
): SelectionContent {
  return everyList<SelectionLists>((list) =>
    listWithout(list, selection, without)
  );
}

/** The entries of both, each once: `a`'s, then those only `b` holds. */
export function selectionJoined(
  a: SelectionLists,
  b: SelectionLists
): SelectionContent {
  return everyList<SelectionLists>((list) => [
    ...a[list],
    ...listWithout(list, b, a),
  ]);
}

/** Whether `selection` holds nothing in any list. */
export function selectionIsEmpty(selection: SelectionLists): boolean {
  return SELECTION_LISTS.every((list) => selection[list].length === 0);
}

/** Whether two lists of `list` hold equal entries in the same order. */
export function equalLists<L extends SelectionList>(
  list: L,
  a: readonly ListValue<L>[],
  b: readonly ListValue<L>[]
): boolean {
  const descriptor: ListDescriptorOf<L> = listDescriptor(list);
  return sameSequence(a, b, descriptor.equals);
}

/**
 * The `since` of the entry `id` of `list` in `selection`; none where it is
 * not there, or its `since` is not known yet.
 */
export function sinceOf(
  list: SelectionList,
  selection: SelectionContent,
  id: number
): number | undefined {
  const { id: idOf } = listDescriptor(list);
  return selection[list].some((value) => idOf(value) === id)
    ? selection.since?.[list]?.get(id)
    : undefined;
}

/**
 * `selection` with `value` added to `list`, which must not hold it: at
 * `since`, its old place (before the first entry the reader orders after
 * it; one whose `since` is not known yet comes after), else at the end,
 * with no `since` kept for it, so the write gives it a new one. A `since`
 * kept for an entry no longer held is never read.
 */
export function withEntryAt<L extends SelectionList>(
  list: L,
  selection: SelectionContent,
  value: ListValue<L>,
  since?: number
): SelectionContent {
  const { id: idOf } = listDescriptor(list);
  const id = idOf(value);
  const known = new Map(selection.since?.[list]);
  const entries: readonly ListValue<L>[] = selection[list];
  if (since === undefined) {
    known.delete(id);
    return withList(list, selection, [...entries, value], known);
  }
  const entry = { since, tieBreak: id };
  const after = entries.findIndex(
    (other) =>
      compareBySince(entry, {
        since: known.get(idOf(other)) ?? Infinity,
        tieBreak: idOf(other),
      }) < 0
  );
  const placed = [...entries];
  placed.splice(after === -1 ? placed.length : after, 0, value);
  return withList(list, selection, placed, known.set(id, since));
}

/**
 * `selection` with `since` (as a write stored it) for the entries it
 * holds; so an entry just added has its place before the store answered.
 */
export function withSince(
  selection: SelectionContent,
  since: SinceByList
): SelectionContent {
  const merged: { [L in SelectionList]?: ReadonlyMap<number, number> } = {
    ...selection.since,
  };
  for (const list of SELECTION_LISTS) {
    const written = since[list];
    if (written === undefined) {
      continue;
    }
    const { id } = listDescriptor(list);
    const held = new Set(selection[list].map((value) => id(value)));
    const known = new Map(selection.since?.[list]);
    for (const [entry, value] of written) {
      if (held.has(entry)) {
        known.set(entry, value);
      }
    }
    merged[list] = known;
  }
  return { ...selection, since: merged };
}

/**
 * `selection` with `entries` as its `list` and `known` as that list's
 * `since`; typed by `L`, as the computed key alone would not check that
 * `entries` are the list's own.
 */
function withList<L extends SelectionList>(
  list: L,
  selection: SelectionContent,
  entries: readonly ListValue<L>[],
  known: ReadonlyMap<number, number>
): SelectionContent {
  return {
    ...selection,
    [list]: entries,
    since: { ...selection.since, [list]: known },
  };
}
