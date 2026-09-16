import { Injectable } from '@angular/core';
import { Force } from './world-objects/force';
import { WorldObject } from './world-objects/world-object';

@Injectable({
  providedIn: 'root',
})
export class GravityWorldService {
  private worldObjects: Array<WorldObject> = [];
  private universe: { G: number; width: number; height: number } = {
    width: 1000,
    height: 1000,
    G: 10,
  };
  private forces: Set<Force> = new Set();

  addWorldObject(wo: WorldObject): void {
    this.worldObjects.push(wo);
  }
  setUniverse(
    width: number,
    height: number,
    gravitationalConstant: number
  ): void {
    this.universe = { width, height, G: gravitationalConstant };
  }

  /**
   * Moves the world on by `dT` of world time: every pair of objects pulls on
   * each other, then every object is moved once by the sum of what pulled on
   * it. Gathering first and moving after is what keeps an orbit the same
   * whether the world holds two bodies or twenty.
   */
  calcNextTick(dT: number): void {
    // apply gravity between all objects
    for (let i = 0; i < this.worldObjects.length; i++) {
      const current = this.worldObjects[i];
      for (let j = i + 1; j < this.worldObjects.length; j++) {
        const other = this.worldObjects[j];
        const distance = current.distanceTo(other);
        const forceMagnitude =
          (-this.universe.G * current.mass * other.mass) / distance ** 2;
        const forceDirection = current.directionTo(other);
        const directedForce = forceDirection.mul(forceMagnitude);

        current.addForce(directedForce);
        other.addForce(directedForce.mul(-1));
      }
      for (const force of this.forces) {
        force.applyForceFor(current);
      }
    }
    for (const wo of this.worldObjects) {
      wo.integrate(dT);
    }
  }

  /**
   * Appends the current position of every moving object to its trail.
   * Pass a `maxTrailPoints` of zero or less to switch trails off and clear them.
   */
  recordTrails(maxTrailPoints: number): void {
    for (const wo of this.worldObjects) {
      if (wo.isStatic) {
        continue;
      }
      wo.recordTrail(maxTrailPoints);
    }
  }

  getWorldObjects(): Array<WorldObject> {
    return Array.from(this.worldObjects);
  }

  removeWorldObject(woToRemove: WorldObject): void {
    this.worldObjects = this.worldObjects.filter((wo) => wo !== woToRemove);
  }

  getForces(): Array<Force> {
    return Array.from(this.forces);
  }

  removeAll(): void {
    this.worldObjects = [];
    this.forces.clear();
  }

  addForceObject(forceObj: Force): void {
    this.forces.add(forceObj);
  }

  removeForceObject(springForce: Force): boolean {
    return this.forces.delete(springForce);
  }
}
