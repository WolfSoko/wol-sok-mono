import type { Verein } from '../domain/verein';
import type { DbbObject } from './dbb-object';

/** A Verein from the DBB's `club` object (`vereinId`, `vereinsname`). */
export function mapVerein(club: DbbObject): Verein {
  return {
    id: club.number('vereinId'),
    name: club.string('vereinsname').trim(),
  };
}
