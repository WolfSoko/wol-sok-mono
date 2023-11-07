import { WorldObject } from './world-object';

export class Sun extends WorldObject {
  override isStatic = true;
  override id = 'Sun';
}
