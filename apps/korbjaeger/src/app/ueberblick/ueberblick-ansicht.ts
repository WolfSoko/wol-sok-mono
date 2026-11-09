import {
  gemeinsamerUeberblick,
  nachNaechstemSpiel,
  zuletztGespielt,
  type PersonId,
  type SaisonMitUeberblick,
  type SaisonSpiel,
  type Spiel,
} from '@wolsok/feat-shared-basketball-data';
import type { Kind } from '../auswahl/kind';
import { aeltesterStand, type Stand } from '../basketball-data/stand';
import type { HallenStand } from '../halle/hallen-stand';
import { spielZeile, type SpielZeile } from '../spiel/spiel-zeile';
import type { KaderFunde } from './kader-suche';
import type { TeamKarte } from './team-karte';

/** A followed Team as the overview holds it: its card and its reads. */
export interface TeamImUeberblick {
  readonly karte: TeamKarte;
  /** Its Saison with its overview (`teamUeberblick`), once read. */
  readonly saison?: SaisonMitUeberblick;
  /** The read of its next Spiel's Halle, once it started. */
  readonly halle?: HallenStand;
  /** The oldest Stand of its Saison and next Spiel. */
  readonly stand?: Stand;
  /**
   * What its Kader told of the marked Kinder, the last finds kept while it
   * is searched again; none before the first search ended.
   */
  readonly funde?: KaderFunde;
  /** Whether its Kader is still searched, its Saison read before. */
  readonly sucht: boolean;
}

/** What the overview shows of a Kind no Team's Kader named. */
export type NichtGefunden =
  /** Not on any followed Team's Kader of its last played Spiele. */
  | 'nicht-im-kader'
  /**
   * A Team's Spiele or Spielberichte could not all be read, so the Kind
   * may be on a Kader unread.
   */
  | 'nicht-lesbar';

/** One marked Kind on the overview, across the followed Teams it plays for. */
export interface KindAbschnitt {
  readonly personId: PersonId;
  /** The Spitzname, else the first name its Kader gives, else "Mein Kind". */
  readonly titel: string;
  /** The cards of the Teams whose Kader named the Kind, as followed. */
  readonly teams: readonly TeamKarte[];
  /** Whether a Team's Kader is still read, which may add a Team. */
  readonly sucht: boolean;
  /** The first next Spiel of its Teams, by which the overview orders them. */
  readonly naechstesSpiel?: Spiel;
  readonly naechstes?: SpielZeile;
  /** The heading of `naechstes`, naming its Team where the Kind has several. */
  readonly naechstesTitel: string;
  /** The read of that Spiel's Halle. */
  readonly halle?: HallenStand;
  /** What falls through before `naechstes` (all of it where none is next). */
  readonly ausfaelle: readonly SpielZeile[];
  /** What falls through after `naechstes`, shown below it. */
  readonly spaetereAusfaelle: readonly SpielZeile[];
  /** The latest result of its Teams. */
  readonly letztes?: SpielZeile;
  /** The heading of `letztes`, naming its Team where the Kind has several. */
  readonly letztesTitel: string;
  /**
   * Whether the Kind was on the Kader of `letztes`; none where no
   * Spielbericht tells (none yet, not read, a forfeit).
   */
  readonly imKader?: boolean;
  /** The oldest Stand of its Teams' reads. */
  readonly stand?: Stand;
  /** Why it shows no Team, once no Kader is still read. */
  readonly nichtGefunden?: NichtGefunden;
  /**
   * Whether another Team's Spiele or Spielberichte could not all be read,
   * so the Kind may play for more Teams than it shows.
   */
  readonly vielleichtMehrTeams: boolean;
}

/** What the overview tells an Elternteil who marked no Kind yet. */
export type KindHinweis =
  /** No followed Team has played: a Kind is in no Spielbericht yet. */
  | 'nach-erstem-spiel'
  /** A Team has played: its Spiel page lets the Elternteil mark them. */
  | 'spiel-oeffnen';

/** The overview: the Kinder, the Teams without one, and a hint. */
export interface UeberblickAnsicht {
  /** Each marked Kind, the one that plays first first, then as marked. */
  readonly kinder: readonly KindAbschnitt[];
  /**
   * The followed Teams whose Kader named no Kind (all of them while none
   * is marked), the one that plays first first; a Team whose Kader is
   * still read shows here until a Kind is found in it.
   */
  readonly teams: readonly TeamKarte[];
  readonly hinweis?: KindHinweis;
}

/** What the overview calls a Kind with neither Spitzname nor a Kader yet. */
export const MEIN_KIND = 'Mein Kind';

/**
 * The overview of `teams` for `kinder`, on `heute`: each Kind with the
 * Teams whose Kader named it, the other Teams, and the hint while no Kind
 * is marked. Without a followed Team it is empty, Kinder or not: no Kader
 * can name them.
 *
 * @param heute a German calendar day, `YYYY-MM-DD` (`datumInDeutschland`)
 */
export function ueberblickAnsicht(
  kinder: readonly Kind[],
  teams: readonly TeamImUeberblick[],
  heute: string
): UeberblickAnsicht {
  if (teams.length === 0) {
    return { kinder: [], teams: [] };
  }
  if (kinder.length === 0) {
    const hinweis = kindHinweis(teams, heute);
    return { kinder: [], teams: nachSpiel(teams), ...(hinweis && { hinweis }) };
  }
  const abschnitte = kinder.map((kind) => kindAbschnitt(kind, teams));
  return {
    kinder: nachNaechstemSpiel(abschnitte, (a) => a.naechstesSpiel),
    teams: nachSpiel(teams.filter((team) => ohneKind(team, kinder))),
  };
}

function kindAbschnitt(
  kind: Kind,
  teams: readonly TeamImUeberblick[]
): KindAbschnitt {
  const seine = teams.filter(
    (team) => vorname(team, kind.personId) !== undefined
  );
  const sucht = teams.some((team) => team.sucht);
  const { naechstes, ausfaelle, spaetereAusfaelle, letztes } =
    gemeinsamerUeberblick(
      seine.flatMap(({ saison }) => (saison ? [saison] : []))
    );
  const vonTeam = (spiel: SaisonSpiel | undefined) =>
    spiel && seine.find(({ saison }) => saison?.saison === spiel.saison);
  const imKader = letztes && imKaderVon(vonTeam(letztes), letztes.spiel, kind);
  const nichtGefunden =
    seine.length === 0 && !sucht ? warumNicht(teams) : undefined;
  // a Kind with several Teams: which of them plays
  const titel = (text: string, spiel: SaisonSpiel | undefined) =>
    spiel && seine.length > 1 ? `${text} · ${spiel.saison.team.name}` : text;
  return {
    personId: kind.personId,
    titel:
      kind.spitzname ??
      seine.map((team) => vorname(team, kind.personId)).find(Boolean) ??
      MEIN_KIND,
    teams: seine.map(({ karte }) => karte),
    sucht,
    ausfaelle: ausfaelle.map(zeile),
    spaetereAusfaelle: spaetereAusfaelle.map(zeile),
    naechstesTitel: titel('Nächstes Spiel', naechstes),
    letztesTitel: titel('Letztes Ergebnis', letztes),
    ...(naechstes && {
      naechstesSpiel: naechstes.spiel,
      naechstes: zeile(naechstes),
      halle: vonTeam(naechstes)?.halle,
    }),
    ...(letztes && { letztes: zeile(letztes) }),
    ...(imKader !== undefined && { imKader }),
    stand: aeltesterStand(...seine.map(({ stand }) => stand)),
    ...(nichtGefunden && { nichtGefunden }),
    vielleichtMehrTeams:
      seine.length > 0 &&
      teams.some(
        (team) => !seine.includes(team) && team.funde?.unvollstaendig === true
      ),
  };
}

function zeile({ saison, spiel }: SaisonSpiel): SpielZeile {
  return spielZeile(saison, spiel);
}

/** The first name the Team's Kader gave the Kind `person`, if it named them. */
function vorname(team: TeamImUeberblick, person: PersonId): string | undefined {
  for (const kinder of team.funde?.spiele.values() ?? []) {
    const name = kinder?.get(person);
    if (name !== undefined) {
      return name;
    }
  }
  return undefined;
}

/** Whether `kind` was on `team`'s Kader of `spiel`, where it was read. */
function imKaderVon(
  team: TeamImUeberblick | undefined,
  spiel: Spiel,
  kind: Kind
): boolean | undefined {
  return team?.funde?.spiele.get(spiel.id)?.has(kind.personId);
}

function warumNicht(teams: readonly TeamImUeberblick[]): NichtGefunden {
  return teams.some(({ funde }) => funde?.unvollstaendig)
    ? 'nicht-lesbar'
    : 'nicht-im-kader';
}

/**
 * Whether `team`'s Kader named none of `kinder` so far (or its Saison
 * failed): a Team whose search still runs shows among the others until a
 * Kind is found in it.
 */
function ohneKind(team: TeamImUeberblick, kinder: readonly Kind[]): boolean {
  return (
    team.karte.art === 'fehler' ||
    kinder.every(({ personId }) => vorname(team, personId) === undefined)
  );
}

function nachSpiel(teams: readonly TeamImUeberblick[]): readonly TeamKarte[] {
  return nachNaechstemSpiel(
    teams.map(({ karte }) => karte),
    (karte) => (karte.art === 'geladen' ? karte.naechstesSpiel : undefined)
  );
}

/**
 * The hint while no Kind is marked: once every Saison is read (failed ones
 * aside), `spiel-oeffnen` where a Team played, else `nach-erstem-spiel`;
 * none while no Team is followed or a Saison is still read.
 */
function kindHinweis(
  teams: readonly TeamImUeberblick[],
  heute: string
): KindHinweis | undefined {
  const saisons = teams
    .filter(({ karte }) => karte.art !== 'fehler')
    .map(({ saison }) => saison?.saison);
  if (saisons.length === 0) {
    return undefined;
  }
  if (saisons.some((s) => s && zuletztGespielt(s, heute, 1).length > 0)) {
    return 'spiel-oeffnen';
  }
  return saisons.every((s) => s !== undefined)
    ? 'nach-erstem-spiel'
    : undefined;
}
