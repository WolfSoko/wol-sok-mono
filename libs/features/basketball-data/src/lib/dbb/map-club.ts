import type { Club } from '../domain/club';
import type { DbbObject } from './dbb-object';

/** A Verein from the DBB's `club` object (`vereinId`, `vereinsname`). */
export function mapClub(club: DbbObject): Club {
  return {
    id: club.number('vereinId'),
    name: club.string('vereinsname').trim(),
  };
}
