import type { AssociationId } from './ids';

/** The body a Liga is listed under (a Landesverband, a Regionalliga, ...). */
export interface Association {
  readonly id: AssociationId;
  readonly name: string;
}
