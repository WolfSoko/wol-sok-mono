import { uuidToColor, Vector2d } from '@wolsok/utils-math';
import { WorldObject } from './world-object';

export class Planet extends WorldObject {
  color = uuidToColor(this.id);

  /**
   * Radius of the planet itself in AU, as it really is, and the mass it
   * really has. A planet of the solar system is born with both; one placed by
   * hand has neither and takes its radius from its mass at the earth's
   * density, like any world object.
   */
  private readonly realRadius?: number;
  private readonly realMass: number;

  constructor(
    pos: Vector2d,
    vel?: Vector2d,
    mass = 0,
    id?: string,
    realRadius?: number
  ) {
    super(pos, vel, mass, id);
    this.realRadius = realRadius;
    this.realMass = mass;
  }

  /**
   * The earth is denser than the sun and jupiter is thinner than either, so a
   * planet that knows its own radius keeps it - but only for the mass it came
   * with. Made heavier or lighter it grows and shrinks by the cube root of
   * what changed, the same law every other body here is sized by, so its disc
   * and the orbits it can offer follow the slider.
   */
  override get bodyRadius(): number {
    if (this.realRadius === undefined || this.realMass <= 0) {
      return super.bodyRadius;
    }
    return this.realRadius * Math.cbrt(this.mass / this.realMass);
  }
}
