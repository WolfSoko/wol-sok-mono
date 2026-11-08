import type { Liga } from './liga';
import type { Spiel } from './spiel';
import type { Team } from './team';
import type { Verein } from './verein';

/**
 * A Team's whole Saison: every Spiel in every Liga it plays in (a Vorrunde,
 * then a Hauptrunde), in one list by date.
 */
export interface TeamSaison {
  readonly team: Team;
  readonly verein: Verein;
  /** The Ligen of `spiele`, in the order they first play. */
  readonly ligen: readonly Liga[];
  readonly spiele: readonly Spiel[];
}

/** A Team seen in a Verein's recent Spiele, with the Ligen it played in. */
export interface VereinsTeam {
  readonly team: Team;
  readonly ligen: readonly Liga[];
}
