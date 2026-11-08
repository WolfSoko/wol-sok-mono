import type { Halle } from './halle';
import type { Liga } from './liga';
import type { LigaId, SpielId } from './ids';
import type { Team } from './team';

/** One side of a Spiel. */
export type SpielSeite = 'heim' | 'gast';

/**
 * Who plays on one side: a Team, or a slot the Liga fills later (e.g.
 * "Nord 1. Platz" in a Hauptrunde before its Vorrunde ended).
 */
export type SpielPartei =
  | { readonly art: 'team'; readonly team: Team }
  | { readonly art: 'offen'; readonly bezeichnung: string };

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
 *   (`verzichtet`, absent when the DBB names neither).
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
