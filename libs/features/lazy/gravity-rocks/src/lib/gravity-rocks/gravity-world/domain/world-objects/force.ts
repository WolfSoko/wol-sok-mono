import { Vector2d } from '@wolsok/utils-math';
import { WorldObject } from './world-object';

export abstract class Force {
  constructor(public id: string) {}

  abstract applyForceFor(wo: WorldObject): void;
}

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

  updateSpringEnd(newSpringEnd: Vector2d): void {
    this.springEnd = newSpringEnd;
  }
}
