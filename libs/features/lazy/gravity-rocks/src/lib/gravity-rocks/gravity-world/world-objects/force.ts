import { Vector2d } from '../vector-2d';
import { WorldObject } from './world-object';

export interface Force {
  applyForceFor(wo: WorldObject, dT: number): void;
}

export class SpringForce implements Force {
  private springEnd: Vector2d;

  constructor(
    private wo: WorldObject,
    private springStrength: number
  ) {
    this.springEnd = wo.pos;
  }

  applyForceFor(woToApply: WorldObject, dT: number): void {
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

    // damping
    const damping = 100000;
    const dampingForce: Vector2d = woToApply.vel.mul(-damping);

    woToApply.applyForce(directedForce.add(dampingForce), dT, true);
  }

  updateSpringEnd(newSpringEnd: Vector2d): void {
    this.springEnd = newSpringEnd;
  }
}
