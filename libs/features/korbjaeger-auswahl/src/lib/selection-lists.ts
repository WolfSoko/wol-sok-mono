import { gleicheFolge } from './gleiche-folge';
import type { ListDescriptor } from './list-descriptor';
import { CHILDREN } from './lists/children';
import { TEAMS } from './lists/teams';
import { CLUB_COLORS } from './lists/club-colors';
import { vorSeit } from './selection-entries';

/**
 * Every list's descriptor, by the list: what an entry is, what a change
 * writes of one and the document's field that stores it, each taken from
 * here (`ListValue`, `ListField`, `ListDocumentField`). A new list gets its
 * descriptor here, its cap in `AUSWAHL_GRENZEN` and its rules.
 */
export const LIST_DESCRIPTORS = {
  teams: TEAMS,
  kinder: CHILDREN,
  vereinsfarben: CLUB_COLORS,
} as const;

/** The lists of an `Auswahl`. */
export type AuswahlListe = keyof typeof LIST_DESCRIPTORS;

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
  readonly [L in AuswahlListe]: DescriptorTypes<(typeof LIST_DESCRIPTORS)[L]>;
};

/** An entry of the list `L`. */
export type ListValue<L extends AuswahlListe> = TypesByList[L]['value'];

/** What a change writes of an entry of the list `L`. */
export type ListField<L extends AuswahlListe> = TypesByList[L]['field'];

/** The document's field that stores the list `L`. */
export type ListDocumentField<L extends AuswahlListe> =
  TypesByList[L]['document'];

/** The descriptor of the list `L`. */
export type ListDescriptorOf<L extends AuswahlListe> = ListDescriptor<
  ListValue<L>,
  ListField<L>,
  ListDocumentField<L>
>;

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

/**
 * Every list of an `Auswahl`, in `LIST_DESCRIPTORS`' order, which is the
 * order a change gives out `since` values; taken from the table, so a list
 * it holds is never left out of a loop.
 */
export const AUSWAHL_LISTEN = Object.keys(
  LIST_DESCRIPTORS
) as readonly AuswahlListe[];

/** The descriptor of `list`, typed for it. */
export function listDescriptor<L extends AuswahlListe>(
  list: L
): ListDescriptorOf<L> {
  // each entry of the table is the descriptor its types are taken from
  return LIST_DESCRIPTORS[list] as unknown as ListDescriptorOf<L>;
}

/** Every list's entries. */
export type SelectionLists = {
  readonly [L in AuswahlListe]: readonly ListValue<L>[];
};

/**
 * What an `Auswahl` holds: Meine Teams and the marked Kinder, each once,
 * and the Vereine's colours, one entry a Verein, by its id.
 */
export interface AuswahlInhalt extends SelectionLists {
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
  readonly [L in AuswahlListe]?: ReadonlyMap<number, number>;
};

/** An `Auswahl` that holds nothing. */
export const LEERE_AUSWAHL: AuswahlInhalt = everyList<SelectionLists>(() => []);

/**
 * One value for each list, from `value`: the one place the lists are put
 * together. TypeScript cannot check that `value` gives each list its own
 * type (`T[L]` of a concrete `T` reads as every list's at once), so the
 * cast lives here; `value` is a generic helper of the list (`listWithout`),
 * whose own types hold.
 */
export function everyList<T extends { readonly [L in AuswahlListe]: unknown }>(
  value: (list: AuswahlListe) => unknown
): T {
  return Object.fromEntries(
    AUSWAHL_LISTEN.map((list) => [list, value(list)])
  ) as T;
}

/**
 * The entries of `list` in `selection` without those `without` holds: by
 * id, or, with `byEquals`, only those equal in all they hold (a Kind with
 * another Spitzname stays).
 */
export function listWithout<L extends AuswahlListe>(
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
): AuswahlInhalt {
  return everyList<SelectionLists>((list) =>
    listWithout(list, selection, without)
  );
}

/** The entries of both, each once: `a`'s, then those only `b` holds. */
export function selectionJoined(
  a: SelectionLists,
  b: SelectionLists
): AuswahlInhalt {
  return everyList<SelectionLists>((list) => [
    ...a[list],
    ...listWithout(list, b, a),
  ]);
}

/** Whether `selection` holds nothing in any list. */
export function selectionIsEmpty(selection: SelectionLists): boolean {
  return AUSWAHL_LISTEN.every((list) => selection[list].length === 0);
}

/** Whether two lists of `list` hold equal entries in the same order. */
export function equalLists<L extends AuswahlListe>(
  list: L,
  a: readonly ListValue<L>[],
  b: readonly ListValue<L>[]
): boolean {
  const descriptor: ListDescriptorOf<L> = listDescriptor(list);
  return gleicheFolge(a, b, descriptor.equals);
}

/**
 * The `since` of the entry `id` of `list` in `selection`; none where it is
 * not there, or its `since` is not known yet.
 */
export function sinceOf(
  list: AuswahlListe,
  selection: AuswahlInhalt,
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
export function withEntryAt<L extends AuswahlListe>(
  list: L,
  selection: AuswahlInhalt,
  value: ListValue<L>,
  since?: number
): AuswahlInhalt {
  const { id: idOf } = listDescriptor(list);
  const id = idOf(value);
  const known = new Map(selection.since?.[list]);
  const entries: readonly ListValue<L>[] = selection[list];
  if (since === undefined) {
    known.delete(id);
    return withList(list, selection, [...entries, value], known);
  }
  const entry = { seit: since, sortierung: id };
  const after = entries.findIndex(
    (other) =>
      vorSeit(entry, {
        seit: known.get(idOf(other)) ?? Infinity,
        sortierung: idOf(other),
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
  selection: AuswahlInhalt,
  since: SinceByList
): AuswahlInhalt {
  const merged: { [L in AuswahlListe]?: ReadonlyMap<number, number> } = {
    ...selection.since,
  };
  for (const list of AUSWAHL_LISTEN) {
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

function withList<L extends AuswahlListe>(
  list: L,
  selection: AuswahlInhalt,
  entries: readonly ListValue<L>[],
  known: ReadonlyMap<number, number>
): AuswahlInhalt {
  return {
    ...selection,
    [list]: entries,
    since: { ...selection.since, [list]: known },
  };
}
