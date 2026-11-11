import type { SeasonId } from './ids';

/** One playing year, e.g. `2026/2027`. */
export interface Season {
  readonly id: SeasonId;
  readonly name: string;
}
