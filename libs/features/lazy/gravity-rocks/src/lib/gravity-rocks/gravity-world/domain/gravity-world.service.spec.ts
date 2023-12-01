import { TestBed } from '@angular/core/testing';
import { vec2 } from '@wolsok/utils-math';

import { GravityWorldService } from './gravity-world.service';
import { Force } from './world-objects/force';
import { Planet } from './world-objects/planet';
import { Sun } from './world-objects/sun';
import { WorldObject } from './world-objects/world-object';

describe('GravityWorldService', () => {
  let service: GravityWorldService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GravityWorldService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should have way to add world objects', () => {
    expect(service.addWorldObject).toBeTruthy();
  });

  it('should let me add a static sun', () => {
    const sun: WorldObject = new Sun(vec2(0, 0), undefined, 1000);
    expect(() => service.addWorldObject(sun)).not.toThrow();
  });

  it('should let me add a planets', () => {
    expect(() =>
      service.addWorldObject(new Planet(vec2(50, 50), undefined, 10))
    ).not.toThrow();
  });

  it('should let me set the universe size', () => {
    expect(() => service.setUniverse(1000, 600, 6.7)).not.toThrow();
  });

  it('should not update the suns position', () => {
    const sun: WorldObject = new Sun(vec2(0, 0), undefined, 1000);
    service.setUniverse(1000, 1000, 10);
    service.addWorldObject(sun);
    const planet: WorldObject = new Planet(vec2(0, 100), undefined, 10);
    service.addWorldObject(planet);

    service.calcNextTick(1);

    expect(sun.pos.x).toBe(0);
    expect(sun.pos.y).toBe(0);
  });

  it('should update the y position for a step for the planet', () => {
    const sun: WorldObject = new Sun(vec2(0, 0), undefined, 1000);
    service.setUniverse(1000, 1000, 10);
    service.addWorldObject(sun);
    const planet: WorldObject = new Planet(vec2(0, 100), undefined, 10);
    service.addWorldObject(planet);

    service.calcNextTick(1);
    expect(planet.pos.x).toBe(0);
    expect(planet.pos.y).toBe(99.5);

    expect(sun.pos.x).toBe(0);
    expect(sun.pos.y).toBe(0);

    service.calcNextTick(1);
    expect(planet.pos.x).toBe(0);
    expect(planet.pos.y).toBeCloseTo(97.994962, 6);
  });

  it('should update the x position for a step for the planet', () => {
    const sun: WorldObject = new Sun(vec2(0, 0), undefined, 1000);
    service.setUniverse(1000, 1000, 10);
    service.addWorldObject(sun);
    const planet: WorldObject = new Planet(vec2(100, 0), undefined, 10);
    service.addWorldObject(planet);

    service.calcNextTick(1);
    expect(planet.pos.x).toBe(99.5);
    expect(planet.pos.y).toBe(0);

    service.calcNextTick(1);
    expect(planet.pos.x).toBeCloseTo(97.994962, 6);
    expect(planet.pos.y).toBe(0);
  });

  it('should handle multiple planets', () => {
    const sun: WorldObject = new Sun(vec2(0, 0), undefined, 1000);
    service.setUniverse(1000, 1000, 10);
    service.addWorldObject(sun);
    const planet: WorldObject = new Planet(vec2(100, 0), undefined, 10);
    service.addWorldObject(planet);
    const planet2: WorldObject = new Planet(vec2(0, 100), undefined, 10);
    service.addWorldObject(planet2);

    service.calcNextTick(1);

    expect(planet.pos.x).toBeCloseTo(98.498, 3);
    expect(planet.pos.y).toBeCloseTo(0.001781, 3);

    expect(planet2.pos.x).toBeCloseTo(0.001795, 3);
    expect(planet2.pos.y).toBeCloseTo(98.498187, 3);
  });

  it('should expose the world objects', () => {
    const planet1: WorldObject = new Planet(vec2(0, 100), undefined, 10);
    service.addWorldObject(planet1);
    expect(service.getWorldObjects()).toEqual([planet1]);
  });

  it('should remove a world object', () => {
    const planet1: WorldObject = new Planet(vec2(0, 100), undefined, 10);
    const planet2: WorldObject = new Planet(vec2(0, 200), undefined, 10);
    service.addWorldObject(planet1);
    service.addWorldObject(planet2);

    service.removeWorldObject(planet1);

    expect(service.getWorldObjects()).toEqual([planet2]);
  });

  it('should removeAll world objects', () => {
    service.addWorldObject(new Planet(vec2(0, 100), undefined, 10));
    service.addForceObject(createMockedForce());
    service.removeAll();
    expect(service.getWorldObjects()).toEqual([]);
    expect(service.getForces()).toEqual([]);
  });

  it('should add a force object', () => {
    expect(() => service.addForceObject(createMockedForce())).not.toThrow();
  });

  it('should removeAll force objects', () => {
    const forceObj1 = createMockedForce();
    const forceObj2 = createMockedForce('456');
    service.addForceObject(forceObj1);
    service.addForceObject(forceObj2);
    service.removeForceObject(forceObj2);
    expect(service.getForces()).toEqual([forceObj1]);
  });

  it('should call the force for all objects on nextTick', () => {
    const testForce = createMockedForce();
    service.addForceObject(testForce);
    const planet: WorldObject = new Planet(vec2(100, 100), undefined, 10);
    service.addWorldObject(planet);
    service.setUniverse(1000, 1000, 0);
    const dT = 1;

    service.calcNextTick(dT);

    expect(testForce.applyForceFor).toHaveBeenCalledTimes(1);
    expect(testForce.applyForceFor).toHaveBeenCalledWith(planet, dT);
    (testForce.applyForceFor as jest.Mock).mockClear();

    const planet2: WorldObject = new Planet(vec2(0, 50), undefined, 10);
    service.addWorldObject(planet2);
    service.calcNextTick(dT);

    expect(testForce.applyForceFor).toHaveBeenCalledTimes(2);
    expect(testForce.applyForceFor).toHaveBeenCalledWith(planet, dT);
    expect(testForce.applyForceFor).toHaveBeenCalledWith(planet2, dT);
  });

  function createMockedForce(id: string = '123'): Force {
    return {
      id,
      applyForceFor: jest.fn(),
    };
  }
});
