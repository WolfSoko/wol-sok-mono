import type { Club } from '../domain/club';
import { DbbObject } from './dbb-object';
import { mapClub } from './map-club';

/**
 * Only the Verein of a Verein's Spiele (`club/id/{clubId}/actualmatches`):
 * its Spiele are left unread, so one the mappers cannot read costs no name.
 */
export function mapClubOfGames(data: unknown): Club {
  return mapClub(DbbObject.of(data, 'clubMatches').object('club'));
}
