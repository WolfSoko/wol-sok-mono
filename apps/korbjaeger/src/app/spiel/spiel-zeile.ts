import {
  ausgangVon,
  ergebnisVon,
  ergebnisVorlaeufig,
  gegnerVon,
  ligaVon,
  parteiName,
  seiteVon,
  sonderfallVon,
  type Spiel,
  type SpielAusgang,
  type SpielSonderfall,
  type TeamSaison,
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
  readonly ausgang?: SpielAusgang;
  /** Whether score and `ausgang` may still change (`ergebnisVorlaeufig`). */
  readonly vorlaeufig: boolean;
  readonly markierung?: SpielSonderfall;
}

/** Every Spiel of `saison`, across its Ligen, in the port's date order. */
export function spielZeilen(saison: TeamSaison): readonly SpielZeile[] {
  return saison.spiele.map((spiel) => spielZeile(saison, spiel));
}

/** `spiel` of `saison` as a line, seen from the Saison's Team. */
export function spielZeile(saison: TeamSaison, spiel: Spiel): SpielZeile {
  const seite = seiteVon(spiel, saison.team.id);
  const ergebnis = ergebnisVon(spiel);
  const liga = ligaVon(saison, spiel.ligaId);
  return {
    id: spiel.id,
    datum: spielTag(spiel.datum),
    uhrzeit: spiel.uhrzeit,
    liga: liga?.name ?? '',
    ort: seite && ORT[seite],
    gegner: seite
      ? parteiName(gegnerVon(spiel, seite))
      : `${parteiName(spiel.heim)} – ${parteiName(spiel.gast)}`,
    ergebnis: ergebnis && ergebnisText(ergebnis),
    ausgang: seite && ausgangVon(spiel, seite),
    vorlaeufig: ergebnisVorlaeufig(spiel, liga),
    markierung: sonderfallVon(spiel),
  };
}

const ORT = { heim: 'Heim', gast: 'Auswärts' } as const;
