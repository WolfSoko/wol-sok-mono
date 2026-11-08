import type { VerbandId } from './ids';

/** The body a Liga is listed under (a Landesverband, a Regionalliga, ...). */
export interface Verband {
  readonly id: VerbandId;
  readonly name: string;
}
