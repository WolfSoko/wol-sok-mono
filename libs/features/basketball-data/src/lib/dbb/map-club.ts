import type { Verein } from '../domain/verein';
import { DbbObject } from './dbb-object';
import { mapVerein } from './map-verein';

/**
 * Only the Verein of a Verein's Spiele (`club/id/{clubId}/actualmatches`):
 * its Spiele are left unread, so one the mappers cannot read costs no name.
 */
export function mapClub(data: unknown): Verein {
  return mapVerein(DbbObject.of(data, 'clubMatches').object('club'));
}
