import {
  outcomeOf,
  resultOf,
  resultProvisional,
  opponentOf,
  leagueOf,
  participantName,
  sideOf,
  irregularityOf,
  type Game,
  type GameOutcome,
  type GameIrregularity,
  type TeamSeason,
} from '@wolsok/feat-shared-basketball-data';
import { ergebnisText, spielTag } from './spiel-format';

/** One Spiel seen from a Team, as the screens show it (`SpielZeileComponent`). */
export interface SpielZeile {
  readonly id: number;
  /** The day, e.g. `Sa., 29.08.2026`. */
  readonly datum: string;
  /** The tip-off, `HH:mm`; absent where the DBB has none. */
  readonly uhrzeit?: string;
  readonly liga: string;
  /** Absent where the DBB lists the Team on neither side. */
  readonly ort?: 'Heim' | 'Auswärts';
  /** The opponent, or both sides where `ort` is absent. */
  readonly gegner: string;
  /** The points, home first (`78:47`), once there are any. */
  readonly ergebnis?: string;
  /** How it ended for the Team, once decided (as its score shows it, confirmed or not). */
  readonly ausgang?: GameOutcome;
  /** Whether score and `ausgang` may still change (`resultProvisional`). */
  readonly vorlaeufig: boolean;
  readonly markierung?: GameIrregularity;
}

/** Every Spiel of `saison`, across its Ligen, in the port's date order. */
export function spielZeilen(saison: TeamSeason): readonly SpielZeile[] {
  return saison.games.map((spiel) => spielZeile(saison, spiel));
}

/** `spiel` of `saison` as a line, seen from the Saison's Team. */
export function spielZeile(saison: TeamSeason, spiel: Game): SpielZeile {
  const seite = sideOf(spiel, saison.team.id);
  const ergebnis = resultOf(spiel);
  const liga = leagueOf(saison, spiel.leagueId);
  return {
    id: spiel.id,
    datum: spielTag(spiel.date),
    uhrzeit: spiel.time,
    liga: liga?.name ?? '',
    ort: seite && ORT[seite],
    gegner: seite
      ? participantName(opponentOf(spiel, seite))
      : `${participantName(spiel.home)} – ${participantName(spiel.away)}`,
    ergebnis: ergebnis && ergebnisText(ergebnis),
    ausgang: seite && outcomeOf(spiel, seite),
    vorlaeufig: resultProvisional(spiel, liga),
    markierung: irregularityOf(spiel),
  };
}

const ORT = { home: 'Heim', away: 'Auswärts' } as const;
