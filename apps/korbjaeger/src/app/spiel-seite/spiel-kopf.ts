import {
  resultOf,
  resultProvisional,
  participantName,
  type Game,
  type GameDetails,
  type Participant,
  type GameSide,
  type Score,
  type TeamId,
} from '@wolsok/feat-shared-basketball-data';
import { ergebnisText, spielTagUndUhrzeit } from '../spiel/spiel-format';

/** What a cell shows that has no value yet. */
const KEIN_WERT = '–';

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
  /**
   * The side's final points, `–` while the Spiel has no result: a sum of
   * the quarters entered so far is no final score.
   */
  readonly gesamt: string;
}

/** One period's column: its name and the short heading shown. */
export interface PeriodenSpalte {
  /** `1. Viertel` … `1. Verlängerung` … */
  readonly name: string;
  /** `1.` … `4.`, then `V1` … */
  readonly kurz: string;
}

/** The quarter scores, with a column per period. */
export interface Perioden {
  readonly spalten: readonly PeriodenSpalte[];
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
  /** Whether `ergebnis` awaits the Verband's confirmation. */
  readonly vorlaeufig: boolean;
  /** What became of the Spiel where it is no confirmed result. */
  readonly status?: string;
  /** Absent where the Verband records no quarters. */
  readonly perioden?: Perioden;
}

/** The head of the Spiel page for `details`. */
export function spielKopf(details: GameDetails): SpielKopf {
  const { game: spiel } = details;
  const ergebnis = resultOf(spiel);
  const perioden = periodenVon(details, ergebnis);
  const vorlaeufig = resultProvisional(spiel, details.league);
  const status = statusText(spiel, vorlaeufig);
  return {
    heim: partner(spiel.home),
    gast: partner(spiel.away),
    wann: spielTagUndUhrzeit(spiel.date, spiel.time),
    liga: details.league.name,
    ...(ergebnis && { ergebnis: ergebnisText(ergebnis) }),
    vorlaeufig,
    ...(status && { status }),
    ...(perioden && { perioden }),
  };
}

function partner(partei: Participant): SpielPartner {
  return partei.kind === 'team'
    ? { name: partei.team.name, teamId: partei.team.id }
    : { name: partei.label };
}

function statusText(spiel: Game, vorlaeufig: boolean): string | undefined {
  switch (spiel.status.kind) {
    case 'scheduled':
      return 'Noch kein Ergebnis';
    case 'cancelled':
      return 'abgesagt';
    case 'forfeited': {
      const verzicht = verzichtText(spiel, spiel.status.forfeitedBy);
      return verzicht === undefined ? 'kampflos' : `kampflos · ${verzicht}`;
    }
    case 'played':
      return vorlaeufig ? 'Ergebnis noch nicht bestätigt' : undefined;
  }
}

function verzichtText(
  spiel: Game,
  seiten: readonly GameSide[]
): string | undefined {
  const namen = seiten.map((seite) => participantName(spiel[seite]));
  if (namen.length === 0) {
    return undefined;
  }
  return namen.length === 1
    ? `${namen[0]} hat verzichtet`
    : `${namen.join(' und ')} haben verzichtet`;
}

function periodenVon(
  { game: spiel, quarters: viertel, overtimes: verlaengerungen }: GameDetails,
  ergebnis: Score | undefined
): Perioden | undefined {
  if (viertel.length === 0) {
    return undefined;
  }
  const alle = [...viertel, ...verlaengerungen];
  const zeile = (seite: GameSide): PeriodenZeile => {
    const punkte = alle.map((stand) => stand[seite]);
    return {
      team: participantName(spiel[seite]),
      punkte,
      gesamt: ergebnis === undefined ? KEIN_WERT : String(ergebnis[seite]),
    };
  };
  return {
    spalten: [
      ...viertel.map((_, i) => ({
        name: `${i + 1}. Viertel`,
        kurz: `${i + 1}.`,
      })),
      ...verlaengerungen.map((_, i) => ({
        name: `${i + 1}. Verlängerung`,
        kurz: `V${i + 1}`,
      })),
    ],
    zeilen: [zeile('home'), zeile('away')],
  };
}
