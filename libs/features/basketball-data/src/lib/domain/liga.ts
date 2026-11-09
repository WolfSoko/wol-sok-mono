import type { Geschlecht } from './geschlecht';
import type { LigaId } from './ids';
import type { Saison } from './saison';
import type { Verband } from './verband';

/** A competition a Verband runs within a Saison; a Vorrunde is one too. */
export interface Liga {
  readonly id: LigaId;
  readonly name: string;
  readonly verband: Verband;
  /** The age group's label, e.g. `U14` or `Senioren`. */
  readonly altersklasse: string;
  readonly geschlecht: Geschlecht;
  /** The level, e.g. `Bayernliga` or `Bezirksoberliga`. */
  readonly spielklasse: string;
  /** The Bezirk a Liga below the Verband's own level belongs to. */
  readonly bezirk?: string;
  /** Absent where the DBB leaves it out, as in the Liga search. */
  readonly saison?: Saison;
  /**
   * Set where the DBB keeps no Spielberichte for the Liga: no Kader, no
   * quarters, only results (the BBL, ProA and ProB keep theirs in their own
   * systems, some youth Ligen enter none). Absent where it does or does not
   * say, as in the Liga search.
   */
  readonly ohneSpielberichte?: true;
}
