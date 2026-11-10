import type { TeamId } from '@wolsok/feat-shared-basketball-data';
import {
  ENTFERNT,
  idAus,
  istKarte,
  istZahl,
  type GelesenerEintrag,
  type RohesDokument,
} from './auswahl-eintraege';
import type { AuswahlListenArt } from './auswahl-liste';
import {
  AUSWAHL_LISTEN,
  jedeListe,
  listenArt,
  type AuswahlInhalt,
  type AuswahlListe,
  type AuswahlListen,
  type ListenDokumentFeld,
  type ListenFeld,
  type ListenWert,
} from './auswahl-listen';
import type { KindEintrag } from './listen/kinder';

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
 * Each list's field is its descriptor's (`AUSWAHL_LISTEN_ARTEN`).
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
type GeleseneListen = {
  readonly [L in AuswahlListe]: readonly GelesenerEintrag<ListenWert<L>>[];
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
  const listen = version === AUSWAHL_VERSION ? listenLesen(gelesen) : undefined;
  if (listen === undefined) {
    return KEINS;
  }
  return {
    art: 'aktuell',
    ...jedeListe<AuswahlListen>((liste) =>
      listen[liste].map(({ wert }) => wert)
    ),
    teamsSeit: new Map(listen.teams.map(({ wert, seit }) => [wert, seit])),
    hoechsterSeit: Math.max(
      0,
      ...AUSWAHL_LISTEN.flatMap((liste) =>
        listen[liste].map(({ seit }) => seit)
      )
    ),
    roh: gelesen,
  };
}

/** Each list of `dokument`; `undefined` where one makes it unreadable. */
function listenLesen(dokument: RohesDokument): GeleseneListen | undefined {
  const listen = jedeListe<{
    readonly [L in AuswahlListe]: GeleseneListen[L] | undefined;
  }>((liste) => listenArt(liste).lesen(dokument[listenArt(liste).feld]));
  // every list read: the type of each is its own
  return AUSWAHL_LISTEN.every((liste) => listen[liste] !== undefined)
    ? (listen as GeleseneListen)
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
type ListenFelder<L extends AuswahlListe> = Readonly<
  Record<string, ListenFeld<L>>
>;

/**
 * The entries a change writes, by id, under each list's document field; a
 * map it does not change is left out, so a write keeps it as stored
 * (entries this version cannot read too).
 */
export type AuswahlFelder = {
  readonly [L in AuswahlListe as ListenDokumentFeld<L>]?: ListenFelder<L>;
};

/** The entries `felder` writes of `liste`; none where it leaves it out. */
export function felderDerListe<L extends AuswahlListe>(
  felder: AuswahlFelder,
  liste: L
): ListenFelder<L> | undefined {
  const alle: Readonly<Record<string, ListenFelder<L> | undefined>> = felder;
  return alle[listenArt(liste).feld];
}

/**
 * The entries that take `vorher` to `nachher`, list by list in
 * `AUSWAHL_LISTEN`'s order: those gone, the new ones (since `seitAb`, one
 * millisecond each, in their order, unless `nachher` knows a place for one:
 * a Team followed at its old place) and the ones changed (a Spitzname,
 * colours). Every adapter writes them: the device's merged into its
 * document (`auswahlDokumentMit`), Firestore as fields the server merges.
 */
export function auswahlFelder(
  vorher: AuswahlInhalt,
  nachher: AuswahlInhalt,
  seitAb: number
): AuswahlFelder {
  let seit = seitAb;
  const naechster = (): number => seit++;
  const felder: Record<string, unknown> = {};
  for (const liste of AUSWAHL_LISTEN) {
    const eintraege = listenFelder(liste, vorher, nachher, naechster);
    if (Object.keys(eintraege).length > 0) {
      felder[listenArt(liste).feld] = eintraege;
    }
  }
  // each list's entries under its own field, as `AuswahlFelder` has them
  return felder as AuswahlFelder;
}

/** What `auswahlFelder` writes of `liste`. */
function listenFelder<L extends AuswahlListe>(
  liste: L,
  vorher: AuswahlInhalt,
  nachher: AuswahlInhalt,
  naechster: () => number
): ListenFelder<L> {
  const art: AuswahlListenArt<ListenWert<L>, ListenFeld<L>> = listenArt(liste);
  const felder: Record<string, ListenFeld<L> | typeof ENTFERNT> = {};
  const davor = new Map(vorher[liste].map((wert) => [art.id(wert), wert]));
  for (const wert of nachher[liste]) {
    const id = art.id(wert);
    const alt = davor.get(id);
    davor.delete(id);
    if (alt === undefined) {
      felder[id] = art.neu(
        wert,
        () => art.bekannterSeit?.(nachher, wert) ?? naechster()
      );
    } else if (!art.gleich(alt, wert) && art.geaendert) {
      felder[id] = art.geaendert(alt, wert);
    }
  }
  // what is left was there before and is gone now
  for (const id of davor.keys()) {
    felder[id] = ENTFERNT;
  }
  // every list's `feld` takes `ENTFERNT`
  return felder as ListenFelder<L>;
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
  felder: AuswahlFelder
): RohesDokument {
  const roh = gelesen.art === 'aktuell' ? gelesen.roh : {};
  const dokument: Record<string, unknown> = {
    ...roh,
    version: AUSWAHL_VERSION,
  };
  for (const liste of AUSWAHL_LISTEN) {
    const eintraege = felderDerListe(felder, liste);
    if (eintraege !== undefined) {
      const art: AuswahlListenArt<unknown, unknown> = listenArt(liste);
      const gespeichert = roh[art.feld];
      dokument[art.feld] = art.mit(
        istKarte(gespeichert) ? gespeichert : {},
        eintraege
      );
    }
  }
  return dokument;
}
