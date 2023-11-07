import { Injectable, Signal, signal, WritableSignal } from '@angular/core';
import { Force, SpringForce } from './world-objects/force';
import { WorldObject } from './world-objects/world-object';

@Injectable({
  providedIn: 'root',
})
export class GravityWorldService {
  private worldObjects: Array<WorldObject> = [];
  private universe: { G: number; width: number; height: number } = { width: 1000, height: 1000, G: 10 };
  private forces: Set<Force> = new Set();

  addWorldObject(wo: WorldObject): void {
    this.worldObjects.push(wo);
  }
  setUniverse(width: number, height: number, gravitationalConstant: number): void {
    this.universe = { width, height, G: gravitationalConstant };
  }

  calcNextTick(dT: number): void {
    // apply gravity between all objects
    for (let i = 0; i < this.worldObjects.length; i++) {
      const current = this.worldObjects[i];
      for (let j = i + 1; j < this.worldObjects.length; j++) {
        const other = this.worldObjects[j];
        const distance = current.distanceTo(other);
        const forceMagnitude = (-this.universe.G * current.mass * other.mass) / distance ** 2;
        const forceDirection = current.directionTo(other);
        const directedForce = forceDirection.mul(forceMagnitude);

        current.applyForce(directedForce, dT);
        other.applyForce(directedForce.mul(-1), dT);
      }
      for (const force of this.forces) {
        force.applyForceFor(current, dT);
      }
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
