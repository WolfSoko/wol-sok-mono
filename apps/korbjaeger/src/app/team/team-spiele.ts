import {
  isBasketballDataError,
  type Liga,
  type Spiel,
  type SpielPartei,
  type SpielSeite,
  type Spielstand,
  type TeamId,
  type TeamSaison,
} from '@wolsok/feat-shared-basketball-data';

/** How a Spiel stands out of the plain list. */
export type SpielMarkierung = 'abgesagt' | 'kampflos';

/** One line of a Team's Spiele, as the page shows it. */
export interface SpielZeile {
  readonly id: number;
  /** The day, e.g. `Sa., 29.08.2026`. */
  readonly datum: string;
  /** The tip-off, `HH:mm`; absent where the DBB has none. */
  readonly uhrzeit?: string;
  readonly liga: string;
  readonly ort: 'Heim' | 'Auswärts';
  readonly gegner: string;
  /** The points, home first (`78:47`), once there are any. */
  readonly ergebnis?: string;
  readonly markierung?: SpielMarkierung;
}

const DATUM = new Intl.DateTimeFormat('de-DE', {
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
});

/** Every Spiel of `saison`, across its Ligen, by date and time. */
export function spielZeilen(saison: TeamSaison): readonly SpielZeile[] {
  const ligen = new Map(saison.ligen.map((liga) => [liga.id, liga]));
  return [...saison.spiele]
    .sort((a, b) => anpfiff(a).localeCompare(anpfiff(b)))
    .map((spiel) => spielZeile(spiel, saison.team.id, ligen.get(spiel.ligaId)));
}

/** What the page says when the Team's Spiele could not be read. */
export function fehlerText(error: unknown): string {
  if (isBasketballDataError(error, 'not-found')) {
    return KEIN_TEAM;
  }
  if (isBasketballDataError(error, 'unexpected-shape')) {
    return 'Die Daten des DBB ließen sich nicht lesen. Bitte später noch einmal versuchen.';
  }
  return 'Der DBB ist gerade nicht erreichbar. Bitte später noch einmal versuchen.';
}

/** What the page says for an id that names no Team. */
export const KEIN_TEAM = 'Dieses Team kennt der DBB nicht.';

function spielZeile(
  spiel: Spiel,
  teamId: TeamId,
  liga: Liga | undefined
): SpielZeile {
  const seite = seiteVon(spiel, teamId);
  const ergebnis = ergebnisVon(spiel);
  const markierung = markierungVon(spiel);
  return {
    id: spiel.id,
    datum: DATUM.format(new Date(`${spiel.datum}T00:00:00Z`)),
    ...(spiel.uhrzeit === undefined ? {} : { uhrzeit: spiel.uhrzeit }),
    liga: liga?.name ?? '',
    ort: seite === 'heim' ? 'Heim' : 'Auswärts',
    gegner: name(seite === 'heim' ? spiel.gast : spiel.heim),
    ...(ergebnis === undefined ? {} : { ergebnis: stand(ergebnis) }),
    ...(markierung === undefined ? {} : { markierung }),
  };
}

/** When a Spiel starts, sortable; one without a time sorts first that day. */
function anpfiff(spiel: Spiel): string {
  return `${spiel.datum}T${spiel.uhrzeit ?? ''}`;
}

function seiteVon(spiel: Spiel, teamId: TeamId): SpielSeite {
  return spiel.heim.art === 'team' && spiel.heim.team.id === teamId
    ? 'heim'
    : 'gast';
}

function name(partei: SpielPartei): string {
  return partei.art === 'team' ? partei.team.name : partei.bezeichnung;
}

function ergebnisVon(spiel: Spiel): Spielstand | undefined {
  switch (spiel.status.art) {
    case 'gespielt':
    case 'kampflos':
      return spiel.status.ergebnis;
    default:
      return undefined;
  }
}

function markierungVon(spiel: Spiel): SpielMarkierung | undefined {
  switch (spiel.status.art) {
    case 'abgesagt':
    case 'kampflos':
      return spiel.status.art;
    default:
      return undefined;
  }
}

function stand(ergebnis: Spielstand): string {
  return `${ergebnis.heim}:${ergebnis.gast}`;
}
