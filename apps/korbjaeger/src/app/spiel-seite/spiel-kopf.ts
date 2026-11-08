import {
  ergebnisVon,
  parteiName,
  type Spiel,
  type SpielDetails,
  type SpielPartei,
  type SpielSeite,
  type Spielstand,
  type TeamId,
} from '@wolsok/feat-shared-basketball-data';
import { spielTagUndUhrzeit } from '../spiel/spiel-tag';

/** One side of a Spiel as the Spiel page names it. */
export interface SpielPartner {
  readonly name: string;
  /** The Team to link to; absent for a slot the Liga fills later. */
  readonly teamId?: TeamId;
}

/** One line of the quarter scores: a side's points per period. */
export interface PeriodenZeile {
  readonly team: string;
  readonly punkte: readonly number[];
  readonly gesamt: number;
}

/** The quarter scores, with a column per period. */
export interface Perioden {
  /** Each period's heading: `1. Viertel` … `1. Verlängerung` … */
  readonly namen: readonly string[];
  readonly zeilen: readonly [PeriodenZeile, PeriodenZeile];
}

/** What the Spiel page shows above its Halle and Kader. */
export interface SpielKopf {
  readonly heim: SpielPartner;
  readonly gast: SpielPartner;
  /** E.g. `So., 20.09.2026 · 09:00 Uhr`. */
  readonly wann: string;
  readonly liga: string;
  /** The points, home first (`78:47`), once there are any. */
  readonly ergebnis?: string;
  /** What became of the Spiel where it is no confirmed result. */
  readonly status?: string;
  /** Absent where the Verband records no quarters. */
  readonly perioden?: Perioden;
}

/** The head of the Spiel page for `details`. */
export function spielKopf(details: SpielDetails): SpielKopf {
  const { spiel } = details;
  const ergebnis = ergebnisVon(spiel);
  const perioden = periodenVon(details, ergebnis);
  const status = statusText(spiel);
  return {
    heim: partner(spiel.heim),
    gast: partner(spiel.gast),
    wann: spielTagUndUhrzeit(spiel.datum, spiel.uhrzeit),
    liga: details.liga.name,
    ...(ergebnis && { ergebnis: `${ergebnis.heim}:${ergebnis.gast}` }),
    ...(status && { status }),
    ...(perioden && { perioden }),
  };
}

/** What the page calls a Kader's side while the Spiel cannot be read. */
export const SEITE: Readonly<Record<SpielSeite, string>> = {
  heim: 'Heim',
  gast: 'Gast',
};

function partner(partei: SpielPartei): SpielPartner {
  return partei.art === 'team'
    ? { name: partei.team.name, teamId: partei.team.id }
    : { name: partei.bezeichnung };
}

function statusText(spiel: Spiel): string | undefined {
  switch (spiel.status.art) {
    case 'geplant':
      return 'Noch nicht gespielt';
    case 'abgesagt':
      return 'abgesagt';
    case 'kampflos': {
      const verzicht = verzichtText(spiel, spiel.status.verzichtet);
      return verzicht === undefined ? 'kampflos' : `kampflos · ${verzicht}`;
    }
    case 'gespielt':
      return spiel.status.bestaetigt
        ? undefined
        : 'Ergebnis noch nicht bestätigt';
  }
}

function verzichtText(
  spiel: Spiel,
  seiten: readonly SpielSeite[]
): string | undefined {
  const namen = seiten.map((seite) => parteiName(spiel[seite]));
  if (namen.length === 0) {
    return undefined;
  }
  return namen.length === 1
    ? `${namen[0]} hat verzichtet`
    : `${namen.join(' und ')} haben verzichtet`;
}

function periodenVon(
  { spiel, viertel, verlaengerungen }: SpielDetails,
  ergebnis: Spielstand | undefined
): Perioden | undefined {
  if (viertel.length === 0) {
    return undefined;
  }
  const alle = [...viertel, ...verlaengerungen];
  const zeile = (seite: SpielSeite): PeriodenZeile => {
    const punkte = alle.map((stand) => stand[seite]);
    return {
      team: parteiName(spiel[seite]),
      punkte,
      gesamt: ergebnis?.[seite] ?? punkte.reduce((sum, p) => sum + p, 0),
    };
  };
  return {
    namen: [
      ...viertel.map((_, i) => `${i + 1}. Viertel`),
      ...verlaengerungen.map((_, i) => `${i + 1}. Verlängerung`),
    ],
    zeilen: [zeile('heim'), zeile('gast')],
  };
}
