import { uuidToColor, Vector2d } from '@wolsok/utils-math';
import { WorldObject } from './world-object';

export class Planet extends WorldObject {
  color = uuidToColor(this.id);

  /**
   * Radius of the planet itself in AU. The real one for a planet of the solar
   * system, and otherwise whatever its mass comes to at the earth's density.
   */
  private readonly realRadius?: number;

  constructor(
    pos: Vector2d,
    vel?: Vector2d,
    mass = 0,
    id?: string,
    realRadius?: number
  ) {
    super(pos, vel, mass, id);
    this.realRadius = realRadius;
  }

  override get bodyRadius(): number {
    return this.realRadius ?? super.bodyRadius;
  }
}
