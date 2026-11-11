import type { Gender } from './gender';
import type { LeagueId } from './ids';
import type { Season } from './season';
import type { Association } from './association';

/** A competition a Verband runs within a Saison; a Vorrunde is one too. */
export interface League {
  readonly id: LeagueId;
  readonly name: string;
  readonly association: Association;
  /** The age group's label, e.g. `U14` or `Senioren`. */
  readonly ageGroup: string;
  readonly gender: Gender;
  /** The level, e.g. `Bayernliga` or `Bezirksoberliga`. */
  readonly division: string;
  /** The Bezirk a Liga below the Verband's own level belongs to. */
  readonly district?: string;
  /** Absent where the DBB leaves it out, as in the Liga search. */
  readonly season?: Season;
  /**
   * Set where the DBB keeps no Spielberichte for the Liga: no Kader, no
   * quarters, only results (the BBL, ProA and ProB keep theirs in their own
   * systems, some youth Ligen enter none). Absent where it does or does not
   * say, as in the Liga search and a Team's Spiele (`teamGames`), whose
   * Ligen never say: ask a Spiel's details (`game`) for it.
   */
  readonly withoutGameReports?: true;
  /**
   * Set where the DBB never confirms a result of the Liga: the BBL, ProA,
   * ProB and BBL-Pokal take theirs from the leagues' own systems, so the
   * score shown is the official one. Absent where the DBB confirms them or
   * does not say, as in the Liga search.
   */
  readonly resultsNeverConfirmed?: true;
}
