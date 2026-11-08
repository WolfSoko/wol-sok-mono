import type { Halle } from './halle';
import type { Liga } from './liga';
import type { LigaId, SpielId, TeamId } from './ids';
import { istTeam, type SpielPartei } from './partei';

/** One side of a Spiel. */
export type SpielSeite = 'heim' | 'gast';

/** The points of both sides, of a whole Spiel or of one period. */
export interface Spielstand {
  readonly heim: number;
  readonly gast: number;
}

/**
 * What became of a Spiel:
 * - `geplant`: not played yet, or played without a result yet.
 * - `gespielt`: played, with the result; `bestaetigt` once the Verband has
 *   confirmed it.
 * - `abgesagt`: called off.
 * - `kampflos`: decided without being played, because a side gave it up
 *   (`verzichtet`: the sides that gave up, empty when the DBB names
 *   neither).
 */
export type SpielStatus =
  | { readonly art: 'geplant' }
  | {
      readonly art: 'gespielt';
      readonly ergebnis: Spielstand;
      readonly bestaetigt: boolean;
    }
  | { readonly art: 'abgesagt' }
  | {
      readonly art: 'kampflos';
      readonly verzichtet: readonly SpielSeite[];
      readonly ergebnis?: Spielstand;
    };

/** One game between two Teams within a Liga. */
export interface Spiel {
  readonly id: SpielId;
  readonly ligaId: LigaId;
  readonly spieltag: number;
  /** The day, `YYYY-MM-DD`; a moved Spiel carries its new day. */
  readonly datum: string;
  /** The tip-off, `HH:mm`; absent where the DBB has none yet. */
  readonly uhrzeit?: string;
  readonly heim: SpielPartei;
  readonly gast: SpielPartei;
  readonly status: SpielStatus;
}

/** A Spiel with its Liga, Halle and the points of each period. */
export interface SpielDetails {
  readonly spiel: Spiel;
  readonly liga: Liga;
  readonly halle?: Halle;
  /** The four quarters' points, empty until the Spiel is recorded. */
  readonly viertel: readonly Spielstand[];
  /** Each overtime's points, in order. */
  readonly verlaengerungen: readonly Spielstand[];
}

/** How a Spiel stands out of the plain schedule. */
export type SpielSonderfall = 'abgesagt' | 'kampflos';

/** The side `team` plays in `spiel`, or `undefined` where it plays none. */
export function seiteVon(spiel: Spiel, team: TeamId): SpielSeite | undefined {
  if (istTeam(spiel.heim, team)) {
    return 'heim';
  }
  return istTeam(spiel.gast, team) ? 'gast' : undefined;
}

/** Who plays against `seite`. */
export function gegnerVon(spiel: Spiel, seite: SpielSeite): SpielPartei {
  return seite === 'heim' ? spiel.gast : spiel.heim;
}

/** The final points of `spiel`, once there are any (a forfeit may have). */
export function ergebnisVon(spiel: Spiel): Spielstand | undefined {
  switch (spiel.status.art) {
    case 'gespielt':
    case 'kampflos':
      return spiel.status.ergebnis;
    case 'geplant':
    case 'abgesagt':
      return undefined;
  }
}

/** Whether `spiel` was called off or decided without being played. */
export function sonderfallVon(spiel: Spiel): SpielSonderfall | undefined {
  switch (spiel.status.art) {
    case 'abgesagt':
    case 'kampflos':
      return spiel.status.art;
    case 'geplant':
    case 'gespielt':
      return undefined;
  }
}
