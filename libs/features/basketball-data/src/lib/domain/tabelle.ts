import type { Liga } from './liga';
import type { SpielPartei } from './spiel';

/** One Team's line in a Liga's Tabelle. */
export interface TabellenZeile {
  readonly rang: number;
  /**
   * The Team, or the slot a Hauptrunde keeps for a Team its Vorrunden have
   * yet to settle ("Nord 1. Platz"), as on either side of a Spiel.
   */
  readonly partei: SpielPartei;
  readonly spiele: number;
  readonly siege: number;
  readonly niederlagen: number;
  readonly punkte: number;
  readonly koerbe: number;
  readonly gegenkoerbe: number;
  readonly korbdifferenz: number;
}

/** A Liga's standings; empty while the Liga keeps none yet. */
export interface Tabelle {
  readonly liga: Liga;
  readonly zeilen: readonly TabellenZeile[];
}
