import { WorldObject } from './world-object';

export class Sun extends WorldObject {
  override isStatic = true;
  override id = 'Sun';

  override get radius(): number {
    return Math.sqrt(this.mass / 10);
  }
}
