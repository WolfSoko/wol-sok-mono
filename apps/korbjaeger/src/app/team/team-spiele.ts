import {
  ergebnisVon,
  gegnerVon,
  parteiName,
  seiteVon,
  sonderfallVon,
  type Liga,
  type Spiel,
  type SpielSonderfall,
  type TeamId,
  type TeamSaison,
} from '@wolsok/feat-shared-basketball-data';

/** One line of a Team's Spiele, as the page shows it. */
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
  readonly markierung?: SpielSonderfall;
}

/** What the page says for an id that names no Team. */
export const KEIN_TEAM = 'Dieses Team kennt der DBB nicht.';

const DATUM = new Intl.DateTimeFormat('de-DE', {
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
});

/** Every Spiel of `saison`, across its Ligen, in the port's date order. */
export function spielZeilen(saison: TeamSaison): readonly SpielZeile[] {
  const ligen = new Map(saison.ligen.map((liga) => [liga.id, liga]));
  return saison.spiele.map((spiel) =>
    spielZeile(spiel, saison.team.id, ligen.get(spiel.ligaId))
  );
}

function spielZeile(
  spiel: Spiel,
  teamId: TeamId,
  liga: Liga | undefined
): SpielZeile {
  const seite = seiteVon(spiel, teamId);
  const ergebnis = ergebnisVon(spiel);
  return {
    id: spiel.id,
    datum: DATUM.format(new Date(`${spiel.datum}T00:00:00Z`)),
    uhrzeit: spiel.uhrzeit,
    liga: liga?.name ?? '',
    ort: seite && ORT[seite],
    gegner: seite
      ? parteiName(gegnerVon(spiel, seite))
      : `${parteiName(spiel.heim)} – ${parteiName(spiel.gast)}`,
    ergebnis: ergebnis && `${ergebnis.heim}:${ergebnis.gast}`,
    markierung: sonderfallVon(spiel),
  };
}

const ORT = { heim: 'Heim', gast: 'Auswärts' } as const;
