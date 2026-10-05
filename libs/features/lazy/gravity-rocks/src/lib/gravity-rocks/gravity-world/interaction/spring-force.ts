import { Vector2d } from '@wolsok/utils-math';
import { Force } from '../domain/world-objects/force';
import { SvgPath } from '../domain/world-objects/svg-paths';
import { WorldObject } from '../domain/world-objects/world-object';

/**
 * How hard the spring pulls per AU it is stretched, in 1/year². It has to
 * out-pull the sun - which is 40 AU/year² at the earth's distance - or
 * dragging a planet would barely budge it.
 */
export const SPRING_STIFFNESS = 400;
/**
 * How hard it brakes per AU/year, in 1/year. With a finger held still the
 * two balance out at `stiffness / damping` AU/year per AU of stretch, so
 * this is what decides the speed a drag hands over: about twelve, which
 * makes half an AU of pull an earth-like orbit.
 */
export const SPRING_DAMPING = 33;
/** Speed a stretch of one AU is worth, in AU/year. */
export const SPRING_SPEED_PER_AU = SPRING_STIFFNESS / SPRING_DAMPING;

/**
 * The rubber band a drag hooks onto a body: it pulls the body towards where
 * the pointer is and brakes it, so the body follows the hand instead of
 * snapping to it. This is an interaction, not physics the world has of its
 * own - nothing but a drag ever puts one into the world.
 */
export class SpringForce extends Force {
  springEnd: Vector2d;

  constructor(
    public wo: WorldObject,
    private springStrength: number = wo.mass * SPRING_STIFFNESS,
    private dampingStrength: number = wo.mass * SPRING_DAMPING
  ) {
    super('ForceOn:' + wo.id);
    this.springEnd = wo.pos;
  }

  applyForceFor(woToApply: WorldObject): void {
    if (this.wo !== woToApply) {
      return;
    }
    const forceDirection: Vector2d = woToApply.pos.directionTo(this.springEnd);
    const distance: number = woToApply.pos.dist(this.springEnd);
    if (distance <= 0.01) {
      return;
    }

    const forceMagnitude: number = -this.springStrength * distance;
    const directedForce: Vector2d = forceDirection.mul(forceMagnitude);

    const dampingForce: Vector2d = woToApply.vel.mul(-this.dampingStrength);

    woToApply.addForce(directedForce.add(dampingForce), true);
  }

  /** The spring is drawn as the line from the body to the hand holding it. */
  override svgPath(): SvgPath {
    const { x, y } = this.wo.pos;
    const { x: x2, y: y2 } = this.springEnd;
    return { id: this.id, path: `M${x} ${y} ${x2} ${y2}` };
  }

  updateSpringEnd(newSpringEnd: Vector2d): void {
    this.springEnd = newSpringEnd;
  }
}
