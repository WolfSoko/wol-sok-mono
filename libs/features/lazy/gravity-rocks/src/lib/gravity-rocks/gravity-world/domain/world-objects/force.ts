import { Vector2d } from '@wolsok/utils-math';
import { WorldObject } from './world-object';

export abstract class Force {
  constructor(public id: string) {}

  abstract applyForceFor(wo: WorldObject, dT: number): void;
}

export class SpringForce extends Force {
  springEnd: Vector2d;

  constructor(
    public wo: WorldObject,
    private springStrength: number = wo.mass,
    private dampingStrength: number = wo.mass
  ) {
    super('ForceOn:' + wo.id);
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

    const dampingForce: Vector2d = woToApply.vel.mul(-this.dampingStrength);

    woToApply.applyForce(directedForce.add(dampingForce), dT, true);
  }

  updateSpringEnd(newSpringEnd: Vector2d): void {
    this.springEnd = newSpringEnd;
  }
}
