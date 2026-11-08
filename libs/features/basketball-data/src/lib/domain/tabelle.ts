import type { Liga } from './liga';
import type { Team } from './team';

/** One Team's line in a Liga's Tabelle. */
export interface TabellenZeile {
  readonly rang: number;
  readonly team: Team;
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
