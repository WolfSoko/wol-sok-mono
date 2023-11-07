import { uuid, vec2, Vector2d } from '@wolsok/utils-math';

export class WorldObject {
  public pos: Vector2d;
  vel: Vector2d = vec2(0, 0);
  private acc: Vector2d = vec2(0, 0);
  public isStatic = false;

  constructor(
    pos: Vector2d,
    vel: Vector2d = vec2(0, 0),
    public mass: number,
    public id: string = uuid()
  ) {
    this.pos = pos;
    this.vel = vel;
  }

  applyForce(vector: Vector2d, dT: number, overrideIsStatic = false): void {
    if (this.isStatic && !overrideIsStatic) {
      return;
    }
    this.acc = this.acc.add(vector.mul(1 / this.mass));
    const dVelocityHalf: Vector2d = this.acc.mul(dT).div(2);
    // adding first half of acceleration to velocity and moving the object
    this.vel = this.vel.add(dVelocityHalf);
    this.pos = this.pos.add(this.vel.mul(dT));
    // adding second half of acceleration to velocity.
    // This is the method of Verlet integration for better accuracy
    this.vel = this.vel.add(dVelocityHalf);

    this.acc = vec2(0, 0);
  }

  distanceTo(other: WorldObject): number {
    return this.pos.dist(other.pos);
  }

  /**
   * Returns a normalised vector pointing from this object to the other object
   * @param other
   */
  directionTo(other: WorldObject): Vector2d {
    return this.pos.directionTo(other.pos);
  }
}
