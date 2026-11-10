import type { TeamId } from '@wolsok/feat-shared-basketball-data';
import { gleicheFolge } from './gleiche-folge';
import type { ListDescriptor } from './list-descriptor';
import type { Kind } from './kind';
import { CHILDREN, type KindFeld } from './lists/children';
import { TEAMS, type TeamFeld } from './lists/teams';
import { CLUB_COLORS, type VereinsfarbenFeld } from './lists/club-colors';
import type { VereinsfarbenWahl } from './vereinsfarben-wahl';

/**
 * Each list of an `Auswahl`: what an entry is (`value`), what a change
 * writes of one (`field`) and the document's field that stores it
 * (`document`). A new list gets its entry here, its descriptor in
 * `LIST_DESCRIPTORS`, its cap in `AUSWAHL_GRENZEN` and its rules.
 */
interface ListTypes {
  readonly teams: {
    readonly value: TeamId;
    readonly field: TeamFeld;
    readonly document: 'teams';
  };
  readonly kinder: {
    readonly value: Kind;
    readonly field: KindFeld;
    readonly document: 'children';
  };
  readonly vereinsfarben: {
    readonly value: VereinsfarbenWahl;
    readonly field: VereinsfarbenFeld;
    readonly document: 'clubColors';
  };
}

/** The lists of an `Auswahl`. */
export type AuswahlListe = keyof ListTypes;

/** An entry of the list `L`. */
export type ListValue<L extends AuswahlListe> = ListTypes[L]['value'];

/** What a change writes of an entry of the list `L`. */
export type ListField<L extends AuswahlListe> = ListTypes[L]['field'];

/** The document's field that stores the list `L`. */
export type ListDocumentField<L extends AuswahlListe> =
  ListTypes[L]['document'];

/** The descriptor of the list `L`. */
export type ListDescriptorOf<L extends AuswahlListe> = ListDescriptor<
  ListValue<L>,
  ListField<L>,
  ListDocumentField<L>
>;

/** Every list's descriptor, by the list. */
export const LIST_DESCRIPTORS: {
  readonly [L in AuswahlListe]: ListDescriptorOf<L>;
} = { teams: TEAMS, kinder: CHILDREN, vereinsfarben: CLUB_COLORS };

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
  return LIST_DESCRIPTORS[list];
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
   * Each Team's `seit`, where it is known: as read for a stored Team, as
   * given for one followed at its old place (`folgenAenderung`). A Team
   * without one (followed, not stored yet) counts as the newest.
   */
  readonly teamsSeit?: ReadonlyMap<TeamId, number>;
}

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
