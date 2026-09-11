import { uuid, vec2, Vector2d } from '@wolsok/utils-math';

const MAX_ACCELERATION = 3000;

const MAX_VELOCITY = 1000;

/**
 * Minimal distance between two recorded trail points. Keeps the trail from
 * piling up hundreds of points on top of each other for slow moving objects.
 */
const MIN_TRAIL_POINT_DISTANCE = 2;

export class WorldObject {
  public pos: Vector2d;
  vel: Vector2d = vec2(0, 0);
  private acc: Vector2d = vec2(0, 0);
  public isStatic = false;
  private trailPoints: Vector2d[] = [];

  constructor(
    pos: Vector2d,
    vel: Vector2d = vec2(0, 0),
    public mass: number,
    public id: string = uuid()
  ) {
    this.pos = pos;
    this.vel = vel;
  }

  get radius(): number {
    return 5 + Math.sqrt(this.mass);
  }

  /** Recorded positions, oldest first. */
  get trail(): readonly Vector2d[] {
    return this.trailPoints;
  }

  applyForce(vector: Vector2d, dT: number, overrideIsStatic = false): void {
    if (this.isStatic && !overrideIsStatic) {
      return;
    }
    this.acc = this.acc.add(vector.mul(1 / this.mass));
    if (this.acc.length() > MAX_ACCELERATION) {
      this.acc = this.acc.norm().mul(MAX_ACCELERATION);
    }
    const dVelocityHalf: Vector2d = this.acc.mul(dT).div(2);
    // adding first half of acceleration to velocity and moving the object
    this.vel = this.vel.add(dVelocityHalf);
    this.pos = this.pos.add(this.vel.mul(dT));
    // adding second half of acceleration to velocity.
    // This is the method of Verlet integration for better accuracy
    this.vel = this.vel.add(dVelocityHalf);
    if (this.vel.length() > MAX_VELOCITY) {
      this.vel = this.vel.norm().mul(MAX_VELOCITY);
    }

    this.acc = vec2(0, 0);
  }

  /**
   * Appends the current position to the trail, dropping the oldest points once
   * `maxPoints` is exceeded. A `maxPoints` of zero or less clears the trail.
   */
  recordTrail(maxPoints: number): void {
    if (maxPoints <= 0) {
      this.clearTrail();
      return;
    }
    const last: Vector2d | undefined =
      this.trailPoints[this.trailPoints.length - 1];
    if (last && last.dist(this.pos) < MIN_TRAIL_POINT_DISTANCE) {
      return;
    }
    this.trailPoints.push(this.pos);
    if (this.trailPoints.length > maxPoints) {
      this.trailPoints.splice(0, this.trailPoints.length - maxPoints);
    }
  }

  /** Forgets all recorded trail positions. */
  clearTrail(): void {
    this.trailPoints = [];
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
