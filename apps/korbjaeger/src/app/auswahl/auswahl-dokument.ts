import {
  isDbbId,
  type PersonId,
  type TeamId,
  type VereinId,
} from '@wolsok/feat-shared-basketball-data';
import {
  istFarbe,
  type Vereinsfarben,
  type VereinsfarbenWahl,
} from '../vereinsfarben/vereinsfarben';
import { kindMit, type Kind } from './kind';

/**
 * The version of `AuswahlDokument` this app writes. Bumped only for a
 * change an older app would misread; a new field is none (Kinder joined
 * version 1 as a field of their own, the Vereinsfarben version 2), since
 * every write keeps the fields it does not know. Version 2 keys both lists by id: an app of version 1,
 * still open in a tab, takes it for a newer one and leaves it alone rather
 * than overwrite its maps with lists. The reader still takes version 1's
 * lists (the device's storage holds them), and a map stays a list until a
 * change touches it.
 */
export const AUSWAHL_VERSION = 2;

/** The first version, of lists, which this version still reads. */
const ERSTE_VERSION = 1;

/**
 * How many Teams, Kinder and Vereine with colours an `Auswahl` holds at
 * most: the Firestore rules (`firestore.rules`) refuse more, and their spec
 * checks these numbers.
 */
export const AUSWAHL_GRENZEN = {
  teams: 50,
  kinder: 20,
  vereinsfarben: 50,
} as const;

/** The lists of an `Auswahl`, each with its cap. */
export type AuswahlListe = keyof typeof AUSWAHL_GRENZEN;

/** A marked Kind as stored: since when it is marked, and its Spitzname. */
export interface KindEintrag {
  /** Milliseconds since 1970, the order of the Kinder. */
  readonly seit: number;
  readonly spitzname?: string;
}

/**
 * What an adapter stores of an `Auswahl`: ids only, never names from the
 * DBB. Keyed by id, so each change writes its own entries and the server
 * merges them with another device's (a Team followed, a Kind unmarked, a
 * Spitzname changed: none overwrites the other); `seit` keeps the order.
 */
export interface AuswahlDokument {
  readonly version: typeof AUSWAHL_VERSION;
  /** Each Team's id, since when it is followed (ms since 1970). */
  readonly teams: Readonly<Record<string, number>>;
  readonly kinder: Readonly<Record<string, KindEintrag>>;
  /** Each Verein's colours, by its id; a Verein without any has no entry. */
  readonly vereinsfarben?: Readonly<Record<string, Vereinsfarben>>;
}

/**
 * What an `Auswahl` holds: Meine Teams and the marked Kinder, each once,
 * and the Vereine's colours, one entry a Verein, by its id.
 */
export interface AuswahlInhalt {
  readonly teams: readonly TeamId[];
  readonly kinder: readonly Kind[];
  readonly vereinsfarben: readonly VereinsfarbenWahl[];
}

/** An `Auswahl` that holds nothing. */
export const LEERE_AUSWAHL: AuswahlInhalt = {
  teams: [],
  kinder: [],
  vereinsfarben: [],
};

/** A stored document's fields, as read. */
export type RohesDokument = Readonly<Record<string, unknown>>;

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

/**
 * Tells what `gelesen`, a stored document, is. Without Teams (a document
 * holding only Kinder) it has none; with Teams that are not all ids it is
 * none. Of its Kinder it keeps each entry it can read; where the field is
 * neither map nor list (missing, as before Kinder joined, or malformed) it
 * has none, the Teams kept all the same; so with its Vereinsfarben, which
 * come by the Verein's id. Entries come in the order of
 * their `seit`, the id deciding a tie; lists in their order.
 */
export function auswahlDokumentLesen(gelesen: unknown): GelesenesDokument {
  if (!istKarte(gelesen)) {
    return KEINS;
  }
  const { version, teams, kinder, vereinsfarben } = gelesen;
  if (typeof version === 'number' && version > AUSWAHL_VERSION) {
    return { art: 'neuer' };
  }
  const gelesenTeams = teams === undefined ? [] : teamsLesen(teams);
  if (
    typeof version !== 'number' ||
    version < ERSTE_VERSION ||
    !Number.isInteger(version) ||
    gelesenTeams === undefined
  ) {
    return KEINS;
  }
  const gelesenKinder = kinderLesen(kinder);
  return {
    art: 'aktuell',
    teams: gelesenTeams.map(({ id }) => id),
    kinder: gelesenKinder.map(({ kind }) => kind),
    vereinsfarben: vereinsfarbenLesen(vereinsfarben),
    hoechsterSeit: Math.max(
      0,
      ...gelesenTeams.map(({ seit }) => seit),
      ...gelesenKinder.map(({ seit }) => seit)
    ),
    roh: gelesen,
  };
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

/** Marks an entry, or a Spitzname, that a change takes away. */
export const ENTFERNT = Symbol('entfernt');

/** What a change writes of a Team: since when it is followed, or that it goes. */
export type TeamFeld = number | typeof ENTFERNT;

/** What a change writes of a Kind: all of it, its Spitzname, or that it goes. */
export type KindFeld =
  | KindEintrag
  | { readonly spitzname: string | typeof ENTFERNT }
  | typeof ENTFERNT;

/**
 * What a change writes of a Verein's colours: all of them (a second colour
 * that goes as `ENTFERNT`, as Firestore merges a map into the stored one),
 * or that they go.
 */
export type VereinsfarbenFeld =
  | { readonly primaer: string; readonly zweite: string | typeof ENTFERNT }
  | typeof ENTFERNT;

/**
 * The entries a change writes, by id; a map it does not change is left
 * out, so a write keeps it as stored (Kinder this version cannot read too).
 */
export interface AuswahlFelder {
  readonly teams?: Readonly<Record<string, TeamFeld>>;
  readonly kinder?: Readonly<Record<string, KindFeld>>;
  readonly vereinsfarben?: Readonly<Record<string, VereinsfarbenFeld>>;
}

/**
 * The entries that take `vorher` to `nachher`: the Teams and Kinder gone,
 * the new ones (since `seitAb`, one millisecond each, in their order), the
 * Spitznamen changed and the Vereine whose colours changed or went. Every adapter writes them: the device's merged
 * into its document (`auswahlDokumentMit`), Firestore as fields the server
 * merges.
 */
export function auswahlFelder(
  vorher: AuswahlInhalt,
  nachher: AuswahlInhalt,
  seitAb: number
): AuswahlFelder {
  let seit = seitAb;
  const teams: Record<string, TeamFeld> = {};
  for (const team of vorher.teams) {
    if (!nachher.teams.includes(team)) {
      teams[team] = ENTFERNT;
    }
  }
  for (const team of nachher.teams) {
    if (!vorher.teams.includes(team)) {
      teams[team] = seit++;
    }
  }
  const kinder: Record<string, KindFeld> = {};
  const davor = new Map(vorher.kinder.map((kind) => [kind.personId, kind]));
  const danach = new Set(nachher.kinder.map(({ personId }) => personId));
  for (const { personId } of vorher.kinder) {
    if (!danach.has(personId)) {
      kinder[personId] = ENTFERNT;
    }
  }
  for (const { personId, spitzname } of nachher.kinder) {
    const alt = davor.get(personId);
    if (alt === undefined) {
      kinder[personId] = { seit: seit++, ...(spitzname && { spitzname }) };
    } else if (alt.spitzname !== spitzname) {
      kinder[personId] = { spitzname: spitzname ?? ENTFERNT };
    }
  }
  const vereinsfarben = vereinsfarbenFelder(
    vorher.vereinsfarben,
    nachher.vereinsfarben
  );
  return {
    ...(Object.keys(teams).length > 0 && { teams }),
    ...(Object.keys(kinder).length > 0 && { kinder }),
    ...(Object.keys(vereinsfarben).length > 0 && { vereinsfarben }),
  };
}

function vereinsfarbenFelder(
  vorher: readonly VereinsfarbenWahl[],
  nachher: readonly VereinsfarbenWahl[]
): Readonly<Record<string, VereinsfarbenFeld>> {
  const felder: Record<string, VereinsfarbenFeld> = {};
  const danach = new Set(nachher.map(({ vereinId }) => vereinId));
  for (const { vereinId } of vorher) {
    if (!danach.has(vereinId)) {
      felder[vereinId] = ENTFERNT;
    }
  }
  const davor = new Map(vorher.map((wahl) => [wahl.vereinId, wahl]));
  for (const { vereinId, primaer, zweite } of nachher) {
    const alt = davor.get(vereinId);
    if (alt?.primaer !== primaer || alt.zweite !== zweite) {
      felder[vereinId] = { primaer, zweite: zweite ?? ENTFERNT };
    }
  }
  return felder;
}

/**
 * The document to store: `gelesen`'s fields with this version and `felder`
 * merged into its maps, as Firestore merges them. A map a change leaves
 * out stays as read; one stored as a list (earlier in version 1) becomes a
 * map once changed. A Spitzname for a Kind no longer marked is dropped.
 */
export function auswahlDokumentMit(
  gelesen: GelesenesDokument,
  felder: AuswahlFelder
): RohesDokument {
  const roh = gelesen.art === 'aktuell' ? gelesen.roh : {};
  const inhalt = gelesen.art === 'aktuell' ? gelesen : LEERE_AUSWAHL;
  return {
    ...roh,
    version: AUSWAHL_VERSION,
    ...(felder.teams && {
      teams: teamsMit(
        istKarte(roh['teams'])
          ? roh['teams']
          : Object.fromEntries(inhalt.teams.map((team, i) => [team, i + 1])),
        felder.teams
      ),
    }),
    ...(felder.kinder && {
      kinder: kinderMit(
        istKarte(roh['kinder'])
          ? roh['kinder']
          : Object.fromEntries(
              inhalt.kinder.map(({ personId, spitzname }, i) => [
                personId,
                { seit: i + 1, ...(spitzname && { spitzname }) },
              ])
            ),
        felder.kinder
      ),
    }),
    ...(felder.vereinsfarben && {
      vereinsfarben: vereinsfarbenMit(
        istKarte(roh['vereinsfarben']) ? roh['vereinsfarben'] : {},
        felder.vereinsfarben
      ),
    }),
  };
}

function vereinsfarbenMit(
  vereinsfarben: RohesDokument,
  felder: Readonly<Record<string, VereinsfarbenFeld>>
): RohesDokument {
  const neu: Record<string, unknown> = { ...vereinsfarben };
  for (const [id, feld] of Object.entries(felder)) {
    if (feld === ENTFERNT) {
      delete neu[id];
    } else {
      neu[id] = {
        primaer: feld.primaer,
        ...(feld.zweite !== ENTFERNT && { zweite: feld.zweite }),
      };
    }
  }
  return neu;
}

function teamsMit(
  teams: RohesDokument,
  felder: Readonly<Record<string, TeamFeld>>
): RohesDokument {
  const neu: Record<string, unknown> = { ...teams };
  for (const [id, feld] of Object.entries(felder)) {
    if (feld === ENTFERNT) {
      delete neu[id];
    } else {
      neu[id] = feld;
    }
  }
  return neu;
}

function kinderMit(
  kinder: RohesDokument,
  felder: Readonly<Record<string, KindFeld>>
): RohesDokument {
  const neu: Record<string, unknown> = { ...kinder };
  for (const [id, feld] of Object.entries(felder)) {
    const alt = neu[id];
    if (feld === ENTFERNT) {
      delete neu[id];
    } else if ('seit' in feld) {
      neu[id] = { ...(istKarte(alt) ? alt : {}), ...feld };
    } else if (istKarte(alt)) {
      const { spitzname: _alt, ...ohne } = alt;
      neu[id] =
        feld.spitzname === ENTFERNT
          ? ohne
          : { ...ohne, spitzname: feld.spitzname };
    }
  }
  return neu;
}

interface Gelesen<T> {
  readonly seit: number;
  readonly sortierung: number;
  readonly wert: T;
}

/** The Teams of a list or map; `undefined` where any is no id. */
function teamsLesen(
  teams: unknown
): readonly { readonly id: TeamId; readonly seit: number }[] | undefined {
  if (Array.isArray(teams)) {
    return teams.every(istId)
      ? [...new Set(teams as TeamId[])].map((id) => ({ id, seit: 0 }))
      : undefined;
  }
  if (!istKarte(teams)) {
    return undefined;
  }
  const eintraege: Gelesen<TeamId>[] = [];
  for (const [schluessel, seit] of Object.entries(teams)) {
    const id = Number(schluessel);
    if (!istId(id) || String(id) !== schluessel || !istZahl(seit)) {
      return undefined;
    }
    eintraege.push({ seit, sortierung: id, wert: id });
  }
  return geordnet(eintraege).map(({ wert, seit }) => ({ id: wert, seit }));
}

/** The readable Kinder of a list or map, each person once. */
function kinderLesen(
  kinder: unknown
): readonly { readonly kind: Kind; readonly seit: number }[] {
  if (Array.isArray(kinder)) {
    const nachPerson = new Map<PersonId, Kind>();
    for (const eintrag of kinder) {
      if (istListenKind(eintrag) && !nachPerson.has(eintrag.personId)) {
        nachPerson.set(
          eintrag.personId,
          kindMit(eintrag.personId, eintrag.spitzname)
        );
      }
    }
    return [...nachPerson.values()].map((kind) => ({ kind, seit: 0 }));
  }
  if (!istKarte(kinder)) {
    return [];
  }
  const eintraege: Gelesen<Kind>[] = [];
  for (const [schluessel, eintrag] of Object.entries(kinder)) {
    const personId = Number(schluessel);
    if (
      istId(personId) &&
      String(personId) === schluessel &&
      istKarte(eintrag) &&
      istZahl(eintrag['seit']) &&
      (eintrag['spitzname'] === undefined ||
        typeof eintrag['spitzname'] === 'string')
    ) {
      eintraege.push({
        seit: eintrag['seit'],
        sortierung: personId,
        wert: kindMit(personId, eintrag['spitzname']),
      });
    }
  }
  return geordnet(eintraege).map(({ wert, seit }) => ({ kind: wert, seit }));
}

/** The readable colours of a map, by the Verein's id. */
function vereinsfarbenLesen(
  vereinsfarben: unknown
): readonly VereinsfarbenWahl[] {
  if (!istKarte(vereinsfarben)) {
    return [];
  }
  const gelesen: VereinsfarbenWahl[] = [];
  for (const [schluessel, eintrag] of Object.entries(vereinsfarben)) {
    const vereinId: VereinId = Number(schluessel);
    if (
      istId(vereinId) &&
      String(vereinId) === schluessel &&
      istKarte(eintrag) &&
      istFarbe(eintrag['primaer']) &&
      (eintrag['zweite'] === undefined || istFarbe(eintrag['zweite']))
    ) {
      gelesen.push({
        vereinId,
        primaer: eintrag['primaer'],
        ...(eintrag['zweite'] !== undefined && { zweite: eintrag['zweite'] }),
      });
    }
  }
  return gelesen.sort((a, b) => a.vereinId - b.vereinId);
}

/** By `seit`, the id deciding a tie. */
function geordnet<T>(eintraege: Gelesen<T>[]): readonly Gelesen<T>[] {
  return eintraege.sort(
    (a, b) => a.seit - b.seit || a.sortierung - b.sortierung
  );
}

/** A Kind as version 1 first stored it, in a list. */
function istListenKind(eintrag: unknown): eintrag is Kind {
  if (!istKarte(eintrag)) {
    return false;
  }
  const { personId, spitzname } = eintrag;
  return (
    istId(personId) &&
    (spitzname === undefined || typeof spitzname === 'string')
  );
}

function istId(wert: unknown): wert is number {
  return typeof wert === 'number' && isDbbId(wert);
}

function istZahl(wert: unknown): wert is number {
  return typeof wert === 'number' && Number.isFinite(wert);
}

function istKarte(wert: unknown): wert is RohesDokument {
  return typeof wert === 'object' && wert !== null && !Array.isArray(wert);
}
