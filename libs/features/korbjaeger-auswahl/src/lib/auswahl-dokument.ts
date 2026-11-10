import type { TeamId } from '@wolsok/feat-shared-basketball-data';
import {
  ENTFERNT,
  idAus,
  istKarte,
  istZahl,
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
  type ListDescriptorOf,
  type ListDocumentField,
  type ListField,
  type ListValue,
} from './selection-lists';
import type { KindEintrag } from './lists/children';

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
 * Each list's field is its descriptor's (`LIST_DESCRIPTORS`).
 */
export interface AuswahlDokument {
  readonly version: typeof AUSWAHL_VERSION;
  /** Each Team's id, since when it is followed (ms since 1970). */
  readonly teams: Readonly<Record<string, number>>;
  /** The marked Kinder, by person id. */
  readonly children: Readonly<Record<string, KindEintrag>>;
  /**
   * Each Verein's colours, by its id, as one text (`farbenText`); a Verein
   * without any has no entry.
   */
  readonly clubColors?: Readonly<Record<string, string>>;
}

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
  return {
    art: 'aktuell',
    ...everyList<SelectionLists>((list) =>
      lists[list].map(({ value }) => value)
    ),
    teamsSeit: new Map(lists.teams.map(({ value, since }) => [value, since])),
    hoechsterSeit: Math.max(
      0,
      ...LISTS_BY_SINCE.flatMap((list) => lists[list].map(({ since }) => since))
    ),
    roh: gelesen,
  };
}

/** The lists whose entries carry a `since` (`ListDescriptor.orderedBySince`). */
export const LISTS_BY_SINCE: readonly AuswahlListe[] = AUSWAHL_LISTEN.filter(
  (list) => listDescriptor(list).orderedBySince
);

/** Each list of `document`; `undefined` where one makes it unreadable. */
function readLists(document: RohesDokument): ReadLists | undefined {
  const lists = everyList<{
    readonly [L in AuswahlListe]: ReadLists[L] | undefined;
  }>((list) => listDescriptor(list).read(document[listDescriptor(list).field]));
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
 * The entries that take `before` to `after`, list by list in
 * `AUSWAHL_LISTEN`'s order: those gone, the new ones (from `firstSince`, one
 * millisecond each, in their order, unless `after` knows a place for one:
 * a Team followed at its old place) and the ones changed (a Spitzname,
 * colours). Every adapter writes them: the device's merged into its
 * document (`auswahlDokumentMit`), Firestore as fields the server merges.
 */
export function auswahlFelder(
  before: AuswahlInhalt,
  after: AuswahlInhalt,
  firstSince: number
): AuswahlFelder {
  let since = firstSince;
  const next = (): number => since++;
  const fields: Record<string, unknown> = {};
  for (const list of AUSWAHL_LISTEN) {
    const entries = fieldsOf(list, before, after, next);
    if (Object.keys(entries).length > 0) {
      fields[listDescriptor(list).field] = entries;
    }
  }
  // each list's entries under its own field, as `AuswahlFelder` has them
  return fields as AuswahlFelder;
}

/** What `auswahlFelder` writes of `list`. */
function fieldsOf<L extends AuswahlListe>(
  list: L,
  before: AuswahlInhalt,
  after: AuswahlInhalt,
  next: () => number
): ListFields<L> {
  const descriptor: ListDescriptorOf<L> = listDescriptor(list);
  const fields: Record<string, ListField<L> | typeof ENTFERNT> = {};
  const earlier = new Map(
    before[list].map((value) => [descriptor.id(value), value])
  );
  const gone = new Set(earlier.keys());
  for (const value of after[list]) {
    const id = descriptor.id(value);
    const previous = earlier.get(id);
    gone.delete(id);
    if (previous === undefined) {
      fields[id] = descriptor.added(
        value,
        () => descriptor.knownSince?.(after, value) ?? next()
      );
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

/** The `seit` a write of `felder` stores for each Team it follows. */
export function geschriebeneTeamsSeit(
  felder: AuswahlFelder
): ReadonlyMap<TeamId, number> {
  const seiten = new Map<TeamId, number>();
  for (const [schluessel, feld] of Object.entries(felder.teams ?? {})) {
    const team = idAus(schluessel);
    if (team !== undefined && istZahl(feld)) {
      seiten.set(team, feld);
    }
  }
  return seiten;
}

/**
 * `inhalt` with `seiten` (`geschriebeneTeamsSeit`) for the Teams it
 * follows; so a Team just followed has its place before the store
 * answered.
 */
export function mitTeamsSeit(
  inhalt: AuswahlInhalt,
  seiten: ReadonlyMap<TeamId, number>
): AuswahlInhalt {
  const teamsSeit = new Map(inhalt.teamsSeit);
  for (const [team, seit] of seiten) {
    if (inhalt.teams.includes(team)) {
      teamsSeit.set(team, seit);
    }
  }
  return { ...inhalt, teamsSeit };
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
