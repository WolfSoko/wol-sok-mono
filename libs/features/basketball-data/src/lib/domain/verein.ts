import type { VereinId } from './ids';

/** A basketball club that registers Teams. */
export interface Verein {
  readonly id: VereinId;
  readonly name: string;
}
