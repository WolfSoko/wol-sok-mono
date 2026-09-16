import { effect } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vec2 } from '@wolsok/utils-math';

import {
  GravityWorldService,
  MAX_TICK_YEARS,
  MAX_TICKS_PER_FRAME,
} from './gravity-world.service';
import { Force } from './world-objects/force';
import { Planet } from './world-objects/planet';
import { Sun } from './world-objects/sun';
import { WorldObject } from './world-objects/world-object';

describe('GravityWorldService', () => {
  let service: GravityWorldService;

  beforeEach(() => {
    // a world belongs to whoever shows it, so it has to be provided
    TestBed.configureTestingModule({ providers: [GravityWorldService] });
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

  it('should let me set the gravity it runs on', () => {
    expect(() => service.setGravitationalConstant(6.7)).not.toThrow();
  });

  it('should not update the suns position', () => {
    const sun: WorldObject = new Sun(vec2(0, 0), undefined, 1000);
    service.setGravitationalConstant(10);
    service.addWorldObject(sun);
    const planet: WorldObject = new Planet(vec2(0, 100), undefined, 10);
    service.addWorldObject(planet);

    service.calcNextTick(1);

    expect(sun.pos.x).toBe(0);
    expect(sun.pos.y).toBe(0);
  });

  it('should update the y position for a step for the planet', () => {
    const sun: WorldObject = new Sun(vec2(0, 0), undefined, 1000);
    service.setGravitationalConstant(10);
    service.addWorldObject(sun);
    const planet: WorldObject = new Planet(vec2(0, 100), undefined, 10);
    service.addWorldObject(planet);

    // pulled at one per tick squared, and carried by the velocity that makes
    service.calcNextTick(1);
    expect(planet.pos.x).toBe(0);
    expect(planet.pos.y).toBe(99);

    expect(sun.pos.x).toBe(0);
    expect(sun.pos.y).toBe(0);

    service.calcNextTick(1);
    expect(planet.pos.x).toBe(0);
    expect(planet.pos.y).toBeCloseTo(96.979696, 6);
  });

  it('should update the x position for a step for the planet', () => {
    const sun: WorldObject = new Sun(vec2(0, 0), undefined, 1000);
    service.setGravitationalConstant(10);
    service.addWorldObject(sun);
    const planet: WorldObject = new Planet(vec2(100, 0), undefined, 10);
    service.addWorldObject(planet);

    service.calcNextTick(1);
    expect(planet.pos.x).toBe(99);
    expect(planet.pos.y).toBe(0);

    service.calcNextTick(1);
    expect(planet.pos.x).toBeCloseTo(96.979696, 6);
    expect(planet.pos.y).toBe(0);
  });

  it('should handle multiple planets', () => {
    const sun: WorldObject = new Sun(vec2(0, 0), undefined, 1000);
    service.setGravitationalConstant(10);
    service.addWorldObject(sun);
    const planet: WorldObject = new Planet(vec2(100, 0), undefined, 10);
    service.addWorldObject(planet);
    const planet2: WorldObject = new Planet(vec2(0, 100), undefined, 10);
    service.addWorldObject(planet2);

    service.calcNextTick(1);

    // the pull of the sun, and a much smaller one from the other planet
    expect(planet.pos.x).toBeCloseTo(98.996464, 6);
    expect(planet.pos.y).toBeCloseTo(0.003536, 6);

    expect(planet2.pos.x).toBeCloseTo(0.003536, 6);
    expect(planet2.pos.y).toBeCloseTo(98.996464, 6);
  });

  it('should move an object once a tick, not once per other object', () => {
    service.setGravitationalConstant(0);
    const coasting: WorldObject = new Planet(vec2(0, 0), vec2(3, 0), 10);
    service.addWorldObject(coasting);

    service.calcNextTick(1);
    expect(coasting.pos).toEqual(vec2(3, 0));

    // three more objects to pair up with, and still one step of its velocity
    for (let i = 0; i < 3; i++) {
      service.addWorldObject(new Planet(vec2(0, 500 + i), undefined, 10));
    }
    service.calcNextTick(1);

    expect(coasting.pos).toEqual(vec2(6, 0));
  });

  it('should record trails for moving objects only', () => {
    const sun: WorldObject = new Sun(vec2(0, 0), undefined, 1000);
    const planet: WorldObject = new Planet(vec2(100, 0), undefined, 10);
    service.addWorldObject(sun);
    service.addWorldObject(planet);
    service.setGravitationalConstant(10);

    service.recordTrails(10);
    service.calcNextTick(1);
    service.calcNextTick(1);
    service.recordTrails(10);

    expect(sun.trail).toEqual([]);
    expect(planet.trail).toEqual([vec2(100, 0), planet.pos]);
  });

  it('should clear the trails for a maximum of zero', () => {
    const planet: WorldObject = new Planet(vec2(100, 0), undefined, 10);
    service.addWorldObject(planet);

    service.recordTrails(10);
    service.recordTrails(0);

    expect(planet.trail).toEqual([]);
  });

  it('should cut a frame into slices the integrator can follow', () => {
    const planet: WorldObject = new Planet(vec2(0, 100), undefined, 10);
    service.addWorldObject(planet);
    const tick = jest.spyOn(service, 'calcNextTick');

    service.advance(MAX_TICK_YEARS * 4);

    expect(tick).toHaveBeenCalledTimes(4);
    expect(tick.mock.calls.every(([dT]) => dT <= MAX_TICK_YEARS + 1e-9)).toBe(
      true
    );
  });

  it('should never cut a frame into more slices than it can afford', () => {
    service.addWorldObject(new Planet(vec2(0, 100), undefined, 10));
    const tick = jest.spyOn(service, 'calcNextTick');

    service.advance(MAX_TICK_YEARS * MAX_TICKS_PER_FRAME * 10);

    expect(tick).toHaveBeenCalledTimes(MAX_TICKS_PER_FRAME);
  });

  it('should report a frame as one change, however many slices it took', () => {
    service.addWorldObject(new Planet(vec2(0, 100), undefined, 10));
    let published = 0;
    TestBed.runInInjectionContext(() =>
      effect(() => {
        service.worldObjects();
        published++;
      })
    );
    TestBed.tick();

    service.advance(MAX_TICK_YEARS * 10);
    TestBed.tick();

    // once for the first run of the effect, once for the frame
    expect(published).toBe(2);
  });

  it('should record a trail point per slice, and clear on a length of zero', () => {
    const planet: WorldObject = new Planet(vec2(100, 0), undefined, 10);
    service.addWorldObject(planet);
    service.setGravitationalConstant(0);

    service.advance(MAX_TICK_YEARS * 3, 10);
    expect(planet.trail.length).toBeGreaterThan(0);

    service.advance(MAX_TICK_YEARS, 0);
    expect(planet.trail).toEqual([]);
  });

  it('should expose the world objects', () => {
    const planet1: WorldObject = new Planet(vec2(0, 100), undefined, 10);
    service.addWorldObject(planet1);
    expect(service.worldObjects()).toEqual([planet1]);
  });

  it('should remove a world object', () => {
    const planet1: WorldObject = new Planet(vec2(0, 100), undefined, 10);
    const planet2: WorldObject = new Planet(vec2(0, 200), undefined, 10);
    service.addWorldObject(planet1);
    service.addWorldObject(planet2);

    service.removeWorldObject(planet1);

    expect(service.worldObjects()).toEqual([planet2]);
  });

  it('should removeAll world objects', () => {
    service.addWorldObject(new Planet(vec2(0, 100), undefined, 10));
    service.addForceObject(createMockedForce());
    service.removeAll();
    expect(service.worldObjects()).toEqual([]);
    expect(service.forces()).toEqual([]);
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
    expect(service.forces()).toEqual([forceObj1]);
  });

  it('should call the force for all objects on nextTick', () => {
    const testForce = createMockedForce();
    service.addForceObject(testForce);
    const planet: WorldObject = new Planet(vec2(100, 100), undefined, 10);
    service.addWorldObject(planet);
    service.setGravitationalConstant(0);
    const dT = 1;

    service.calcNextTick(dT);

    expect(testForce.applyForceFor).toHaveBeenCalledTimes(1);
    expect(testForce.applyForceFor).toHaveBeenCalledWith(planet);
    (testForce.applyForceFor as jest.Mock).mockClear();

    const planet2: WorldObject = new Planet(vec2(0, 50), undefined, 10);
    service.addWorldObject(planet2);
    service.calcNextTick(dT);

    expect(testForce.applyForceFor).toHaveBeenCalledTimes(2);
    expect(testForce.applyForceFor).toHaveBeenCalledWith(planet);
    expect(testForce.applyForceFor).toHaveBeenCalledWith(planet2);
  });

  function createMockedForce(id = '123'): Force {
    return {
      id,
      applyForceFor: jest.fn(),
      svgPath: () => null,
    };
  }
});
