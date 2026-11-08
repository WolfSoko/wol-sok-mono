import type { LigaId, SpielId, TeamId, VereinId } from './domain/ids';
import type {
  LigaSeite,
  LigaSuche,
  LigaSucheFilter,
} from './domain/liga-suche';
import type { SpielDetails } from './domain/spiel';
import type { Spielbericht } from './domain/spielbericht';
import type { Tabelle } from './domain/tabelle';
import type { Team } from './domain/team';
import type { TeamSaison, VereinsTeams } from './domain/team-saison';

/**
 * The basketball data the app reads, in domain terms. Every read rejects
 * with a `BasketballDataError` only: `not-found`, `unavailable` or
 * `unexpected-shape`. `DbbBasketballData` reads it from the DBB; an
 * official source would be another adapter.
 */
export interface BasketballData {
  /** The search facets and the first page of Ligen for `filter`. */
  ligaSuche(filter: LigaSucheFilter): Promise<LigaSuche>;
  /** A later page of the Ligen for `filter`, from `startIndex` on. */
  ligaSeite(filter: LigaSucheFilter, startIndex: number): Promise<LigaSeite>;
  /** The Teams of a Liga, by name. */
  ligaTeams(liga: LigaId): Promise<readonly Team[]>;
  /** The Teams seen in a Verein's Spiele of the last and next weeks. */
  vereinsTeams(verein: VereinId): Promise<VereinsTeams>;
  /** All Spiele of a Team in the Saison, across its Ligen, by date. */
  teamSpiele(team: TeamId): Promise<TeamSaison>;
  tabelle(liga: LigaId): Promise<Tabelle>;
  /** A Spiel's result, quarters and Halle. */
  spiel(spiel: SpielId): Promise<SpielDetails>;
  /** Both Kader of a Spiel, or `undefined` while there is no Spielbericht. */
  spielbericht(spiel: SpielId): Promise<Spielbericht | undefined>;
}
