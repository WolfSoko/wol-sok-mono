import {
  isDbbId,
  type TeamId,
  type VereinId,
} from '@wolsok/feat-shared-basketball-data';
import {
  farbenAusText,
  farbenText,
  nachVerein,
  type VereinsfarbenWahl,
} from './vereinsfarben-wahl';
import { gleicheFarben } from './vereinsfarben';
import { kindMit, type Kind } from './kind';

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

/** Every list of an `Auswahl`, for code that treats each the same way. */
export const AUSWAHL_LISTEN: readonly AuswahlListe[] = [
  'teams',
  'kinder',
  'vereinsfarben',
];

/** A marked Kind as stored: since when it is marked, and its Spitzname. */
export interface KindEintrag {
  /** Milliseconds since 1970, the order of the Kinder. */
  readonly since: number;
  readonly nickname?: string;
}

/**
 * What an adapter stores of an `Auswahl`: ids only, never names from the
 * DBB. Keyed by id, so each change writes its own entries and the server
 * merges them with another device's (a Team followed, a Kind unmarked, a
 * Spitzname changed: none overwrites the other); `since` keeps the order.
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

/** The stored field of each list of an `Auswahl`. */
export const DOCUMENT_FIELD = {
  teams: 'teams',
  kinder: 'children',
  vereinsfarben: 'clubColors',
} as const satisfies Record<AuswahlListe, keyof AuswahlDokument>;

/**
 * What an `Auswahl` holds: Meine Teams and the marked Kinder, each once,
 * and the Vereine's colours, one entry a Verein, by its id.
 */
export interface AuswahlInhalt {
  readonly teams: readonly TeamId[];
  readonly kinder: readonly Kind[];
  readonly vereinsfarben: readonly VereinsfarbenWahl[];
  /**
   * Each Team's `seit`, where it is known: as read for a stored Team, as
   * given for one followed at its old place (`folgenAenderung`). A Team
   * without one (followed, not stored yet) counts as the newest.
   */
  readonly teamsSeit?: ReadonlyMap<TeamId, number>;
}

/**
 * The place a Team had among Meine Teams, which `Auswahl.entfolgen` hands
 * out so an undo can follow it there again; only an adapter makes one.
 */
export interface TeamPlatz {
  /** The Team's `seit`, which orders Meine Teams. */
  readonly seit: number;
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
 * no map (missing or malformed) it has none, the Teams kept all the same;
 * so with its Vereinsfarben, which come by the Verein's id. Entries come in
 * the order of their `since`, the id deciding a tie. A document of another
 * version than this one is none, of a newer one `neuer`.
 */
export function auswahlDokumentLesen(gelesen: unknown): GelesenesDokument {
  if (!istKarte(gelesen)) {
    return KEINS;
  }
  const { version, teams, children, clubColors } = gelesen;
  if (typeof version === 'number' && version > AUSWAHL_VERSION) {
    return { art: 'neuer' };
  }
  const gelesenTeams = teams === undefined ? [] : teamsLesen(teams);
  if (version !== AUSWAHL_VERSION || gelesenTeams === undefined) {
    return KEINS;
  }
  const gelesenKinder = kinderLesen(children);
  return {
    art: 'aktuell',
    teams: gelesenTeams.map(({ id }) => id),
    teamsSeit: new Map(gelesenTeams.map(({ id, seit }) => [id, seit])),
    kinder: gelesenKinder.map(({ kind }) => kind),
    vereinsfarben: vereinsfarbenLesen(clubColors),
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
  | { readonly nickname: string | typeof ENTFERNT }
  | typeof ENTFERNT;

/** What a change writes of a Verein's colours: their text, or that they go. */
export type VereinsfarbenFeld = string | typeof ENTFERNT;

/**
 * The entries a change writes, by id; a map it does not change is left
 * out, so a write keeps it as stored (Kinder this version cannot read too).
 */
export interface AuswahlFelder {
  readonly teams?: Readonly<Record<string, TeamFeld>>;
  readonly children?: Readonly<Record<string, KindFeld>>;
  readonly clubColors?: Readonly<Record<string, VereinsfarbenFeld>>;
}

/**
 * The entries that take `vorher` to `nachher`: the Teams and Kinder gone,
 * the new ones (since `seitAb`, one millisecond each, in their order), the
 * Spitznamen changed and the Vereine whose colours changed or went. Every adapter writes them: the device's merged
 * into its document (`auswahlDokumentMit`), Firestore as fields the server
 * merges. A new Team whose `seit` `nachher` knows (`teamsSeit`, one followed
 * at its old place) gets that one.
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
      teams[team] = nachher.teamsSeit?.get(team) ?? seit++;
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
      kinder[personId] = {
        since: seit++,
        ...(spitzname && { nickname: spitzname }),
      };
    } else if (alt.spitzname !== spitzname) {
      kinder[personId] = { nickname: spitzname ?? ENTFERNT };
    }
  }
  const vereinsfarben = vereinsfarbenFelder(
    vorher.vereinsfarben,
    nachher.vereinsfarben
  );
  return {
    ...(Object.keys(teams).length > 0 && { teams }),
    ...(Object.keys(kinder).length > 0 && { children: kinder }),
    ...(Object.keys(vereinsfarben).length > 0 && { clubColors: vereinsfarben }),
  };
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

function vereinsfarbenFelder(
  vorher: readonly VereinsfarbenWahl[],
  nachher: readonly VereinsfarbenWahl[]
): Readonly<Record<string, VereinsfarbenFeld>> {
  const felder: Record<string, VereinsfarbenFeld> = {};
  if (vorher === nachher) {
    return felder;
  }
  const davor = new Map(vorher.map((wahl) => [wahl.vereinId, wahl]));
  for (const wahl of nachher) {
    const alt = davor.get(wahl.vereinId);
    davor.delete(wahl.vereinId);
    if (alt === undefined || !gleicheFarben(alt, wahl)) {
      felder[wahl.vereinId] = farbenText(wahl);
    }
  }
  // what is left was there before and is gone now
  for (const vereinId of davor.keys()) {
    felder[vereinId] = ENTFERNT;
  }
  return felder;
}

/**
 * The document to store: `gelesen`'s fields with this version and `felder`
 * merged into its maps, as Firestore merges them. A map a change leaves
 * out stays as read. A Spitzname for a Kind no longer marked is dropped.
 */
export function auswahlDokumentMit(
  gelesen: GelesenesDokument,
  felder: AuswahlFelder
): RohesDokument {
  const roh = gelesen.art === 'aktuell' ? gelesen.roh : {};
  const karte = (feld: keyof AuswahlFelder): RohesDokument => {
    const wert = roh[feld];
    return istKarte(wert) ? wert : {};
  };
  return {
    ...roh,
    version: AUSWAHL_VERSION,
    ...(felder.teams && { teams: eintraegeMit(karte('teams'), felder.teams) }),
    ...(felder.children && {
      children: kinderMit(karte('children'), felder.children),
    }),
    ...(felder.clubColors && {
      clubColors: eintraegeMit(karte('clubColors'), felder.clubColors),
    }),
  };
}

/** `eintraege` with each of `felder` set, or deleted where it goes. */
function eintraegeMit(
  eintraege: RohesDokument,
  felder: Readonly<Record<string, TeamFeld | VereinsfarbenFeld>>
): RohesDokument {
  const neu: Record<string, unknown> = { ...eintraege };
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
    } else if ('since' in feld) {
      neu[id] = { ...(istKarte(alt) ? alt : {}), ...feld };
    } else if (istKarte(alt)) {
      const { nickname: _alt, ...ohne } = alt;
      neu[id] =
        feld.nickname === ENTFERNT
          ? ohne
          : { ...ohne, nickname: feld.nickname };
    }
  }
  return neu;
}

interface Gelesen<T> {
  readonly seit: number;
  readonly sortierung: number;
  readonly wert: T;
}

/** The Teams of a map; `undefined` where any is no id. */
function teamsLesen(
  teams: unknown
): readonly { readonly id: TeamId; readonly seit: number }[] | undefined {
  if (!istKarte(teams)) {
    return undefined;
  }
  const eintraege: Gelesen<TeamId>[] = [];
  for (const [schluessel, seit] of Object.entries(teams)) {
    const id = idAus(schluessel);
    if (id === undefined || !istZahl(seit)) {
      return undefined;
    }
    eintraege.push({ seit, sortierung: id, wert: id });
  }
  return geordnet(eintraege).map(({ wert, seit }) => ({ id: wert, seit }));
}

/** The readable Kinder of a map. */
function kinderLesen(
  kinder: unknown
): readonly { readonly kind: Kind; readonly seit: number }[] {
  if (!istKarte(kinder)) {
    return [];
  }
  const eintraege: Gelesen<Kind>[] = [];
  for (const [schluessel, eintrag] of Object.entries(kinder)) {
    const personId = idAus(schluessel);
    if (
      personId !== undefined &&
      istKarte(eintrag) &&
      istZahl(eintrag['since']) &&
      (eintrag['nickname'] === undefined ||
        typeof eintrag['nickname'] === 'string')
    ) {
      eintraege.push({
        seit: eintrag['since'],
        sortierung: personId,
        wert: kindMit(personId, eintrag['nickname']),
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
  for (const [schluessel, text] of Object.entries(vereinsfarben)) {
    const vereinId: VereinId | undefined = idAus(schluessel);
    const farben = farbenAusText(text);
    if (vereinId !== undefined && farben) {
      gelesen.push({ vereinId, ...farben });
    }
  }
  return nachVerein(gelesen);
}

/**
 * The order of the entries of a map, as the reader gives them: by `seit`,
 * the id (`sortierung`) deciding a tie.
 */
export function vorSeit(
  a: { readonly seit: number; readonly sortierung: number },
  b: { readonly seit: number; readonly sortierung: number }
): number {
  return a.seit - b.seit || a.sortierung - b.sortierung;
}

function geordnet<T>(eintraege: Gelesen<T>[]): readonly Gelesen<T>[] {
  return eintraege.sort(vorSeit);
}

/** The DBB id a map's key holds; `undefined` where it holds none. */
function idAus(schluessel: string): number | undefined {
  const id = Number(schluessel);
  return istId(id) && String(id) === schluessel ? id : undefined;
}

function istId(wert: unknown): wert is number {
  return typeof wert === 'number' && isDbbId(wert);
}

function istZahl(wert: unknown): wert is number {
  return typeof wert === 'number' && Number.isFinite(wert);
}

/** Whether `wert` is a map: an object that is no list. */
export function istKarte(wert: unknown): wert is RohesDokument {
  return typeof wert === 'object' && wert !== null && !Array.isArray(wert);
}
