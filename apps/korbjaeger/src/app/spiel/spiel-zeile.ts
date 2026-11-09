import {
  ausgangVon,
  ergebnisVon,
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
  /** How it ended for the Team, in words; once decided. */
  readonly ausgang?: Ausgang;
  readonly markierung?: SpielSonderfall;
}

/** A decided Spiel's end as the screens say it. */
export type Ausgang = 'Sieg' | 'Niederlage' | 'Unentschieden';

/** Every Spiel of `saison`, across its Ligen, in the port's date order. */
export function spielZeilen(saison: TeamSaison): readonly SpielZeile[] {
  return saison.spiele.map((spiel) => spielZeile(saison, spiel));
}

/** `spiel` of `saison` as a line, seen from the Saison's Team. */
export function spielZeile(saison: TeamSaison, spiel: Spiel): SpielZeile {
  const seite = seiteVon(spiel, saison.team.id);
  const ergebnis = ergebnisVon(spiel);
  return {
    id: spiel.id,
    datum: spielTag(spiel.datum),
    uhrzeit: spiel.uhrzeit,
    liga: ligaVon(saison, spiel.ligaId)?.name ?? '',
    ort: seite && ORT[seite],
    gegner: seite
      ? parteiName(gegnerVon(spiel, seite))
      : `${parteiName(spiel.heim)} – ${parteiName(spiel.gast)}`,
    ergebnis: ergebnis && ergebnisText(ergebnis),
    ausgang: ausgangText(seite && ausgangVon(spiel, seite)),
    markierung: sonderfallVon(spiel),
  };
}

const ORT = { heim: 'Heim', gast: 'Auswärts' } as const;

const AUSGANG: Record<SpielAusgang, Ausgang> = {
  sieg: 'Sieg',
  niederlage: 'Niederlage',
  unentschieden: 'Unentschieden',
};

function ausgangText(ausgang: SpielAusgang | undefined): Ausgang | undefined {
  return ausgang && AUSGANG[ausgang];
}
