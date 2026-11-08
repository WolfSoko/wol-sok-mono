import type { SaisonId } from './ids';

/** One playing year, e.g. `2026/2027`. */
export interface Saison {
  readonly id: SaisonId;
  readonly name: string;
}
