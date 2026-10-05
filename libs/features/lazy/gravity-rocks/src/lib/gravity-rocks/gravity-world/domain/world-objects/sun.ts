import { SUN_RADIUS } from '../solar-system';
import { WorldObject } from './world-object';

export class Sun extends WorldObject {
  override isStatic = true;
  override id = 'Sun';

  /**
   * A star is nothing like a planet inside, so its radius comes from the
   * sun's own density rather than the earth's: the real radius, and the cube
   * root of its mass when someone makes it heavier or lighter.
   */
  override get bodyRadius(): number {
    return this.mass > 0 ? SUN_RADIUS * this.mass ** (1 / 3) : 0;
  }
}
