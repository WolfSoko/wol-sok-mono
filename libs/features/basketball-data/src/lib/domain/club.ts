import type { ClubId } from './ids';

/** A basketball club that registers Teams. */
export interface Club {
  readonly id: ClubId;
  readonly name: string;
}
