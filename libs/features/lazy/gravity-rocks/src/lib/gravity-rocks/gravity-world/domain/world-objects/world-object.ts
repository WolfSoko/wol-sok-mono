import { uuid, vec2, Vector2d } from '@wolsok/utils-math';
import { displayRadius, radiusOfMass } from '../solar-system';

/**
 * Ceilings the integrator needs, in the units of the world: AU per year and
 * AU per year squared. Both sit far beyond anything the solar system does -
 * mercury travels at 10 AU/year and is pulled at 260 AU/year² - so they only
 * ever catch a body that has fallen into another one.
 */
const MAX_ACCELERATION = 1e6;

/** No object may move faster than this, the integrator would lose track. */
export const MAX_VELOCITY = 200;

/**
 * Minimal distance between two recorded trail points, in AU. Keeps the trail
 * from piling up hundreds of points on top of each other for slow movers.
 */
const MIN_TRAIL_POINT_DISTANCE = 0.004;

export class WorldObject {
  public pos: Vector2d;
  vel: Vector2d = vec2(0, 0);
  private acc: Vector2d = vec2(0, 0);
  /** Whether something pulled on the body since the last `integrate`. */
  private pulled = false;
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

  /**
   * Radius of the body itself in AU, from its mass at the density of the
   * earth. A body that knows its own radius overrides this.
   */
  get bodyRadius(): number {
    return radiusOfMass(this.mass);
  }

  /** Radius the body is drawn with in AU, stretched to stay visible. */
  get radius(): number {
    return displayRadius(this.bodyRadius);
  }

  /** Recorded positions, oldest first. */
  get trail(): readonly Vector2d[] {
    return this.trailPoints;
  }

  /**
   * Adds a force to what is pulling on the body this tick. Nothing moves
   * until `integrate` is called: a body is pulled on once per other body in
   * the world, and moving it on every one of those would carry it that many
   * times as far as its velocity says - the world would run at a speed that
   * depends on how many planets are in it.
   */
  addForce(vector: Vector2d, overrideIsStatic = false): void {
    if (this.isStatic && !overrideIsStatic) {
      return;
    }
    this.acc = this.acc.add(vector.mul(1 / this.mass));
    if (this.acc.length() > MAX_ACCELERATION) {
      this.acc = this.acc.norm().mul(MAX_ACCELERATION);
    }
    this.pulled = true;
  }

  /**
   * Moves the body through `dT` of world time, by everything that has pulled
   * on it since the last tick. A static body stays where it is unless it was
   * pulled by a force that overrules that - the spring of a drag.
   *
   * The pull goes into the velocity first and the new velocity carries the
   * body - a leapfrog, which is what keeps an orbit an orbit. Splitting the
   * pull around the move instead reads like better arithmetic and is not: it
   * leaves out the pull at the far end of the step, and the small surplus
   * that leaves behind is paid into the orbit every time round. Over five
   * years of world time it carries mercury more than twice as far out as it
   * started, while this keeps it inside two percent of its orbit.
   */
  integrate(dT: number): void {
    const acc: Vector2d = this.acc;
    const pulled: boolean = this.pulled;
    this.acc = vec2(0, 0);
    this.pulled = false;
    if (this.isStatic && !pulled) {
      return;
    }
    this.vel = this.vel.add(acc.mul(dT));
    if (this.vel.length() > MAX_VELOCITY) {
      this.vel = this.vel.norm().mul(MAX_VELOCITY);
    }
    this.pos = this.pos.add(this.vel.mul(dT));
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
