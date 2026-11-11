import type { TeamId, ClubId } from './ids';

/** One squad of a Verein for one Saison, the same in each of its Ligen. */
export interface Team {
  readonly id: TeamId;
  readonly name: string;
  readonly clubId: ClubId;
}
