import { computed, signal, WritableSignal } from '@angular/core';
import { vec2 } from '@wolsok/utils-math';
import {
  GravityWorldConfig,
  INITIAL_MASS_OF_SUN,
} from '../domain/gravity-world-config';
import { GravityWorldService } from '../domain/gravity-world.service';
import { EARTH_MASS, GRAVITATIONAL_CONSTANT } from '../domain/solar-system';
import { placementRange } from '../domain/world-objects/orbit';
import { Planet } from '../domain/world-objects/planet';
import { Sun } from '../domain/world-objects/sun';
import { GIANT_MASS } from './body-factory';
import { WorldSelectionStore } from './world-selection.store';

const REACH = 3;

describe('WorldSelectionStore', () => {
  let sun: Sun;
  let earth: Planet;
  let settings: WritableSignal<GravityWorldConfig>;
  let objects: GravityWorldService;
  let camera: { forget: jest.Mock; toggleFollow: jest.Mock };
  let clock: { suspend: jest.Mock; resume: jest.Mock };
  let store: WorldSelectionStore;

  beforeEach(() => {
    sun = new Sun(vec2(3, 1.8), undefined, INITIAL_MASS_OF_SUN);
    earth = new Planet(vec2(4, 1.8), vec2(0, -6.28), EARTH_MASS, 'Earth');
    earth.parent = sun;
    settings = signal({
      gravitationalConstant: GRAVITATIONAL_CONSTANT,
      massOfSun: INITIAL_MASS_OF_SUN,
      showTrail: true,
      showVelocity: false,
      trailLength: 100,
      simulationSpeed: 1,
    });
    objects = new GravityWorldService();
    objects.addWorldObject(sun);
    objects.addWorldObject(earth);
    camera = { forget: jest.fn(), toggleFollow: jest.fn() };
    clock = { suspend: jest.fn(), resume: jest.fn() };
    store = new WorldSelectionStore({
      sun: () => sun,
      settings,
      reach: computed(() => REACH),
      objects,
      camera,
      clock,
    });
  });

  /** A moon put around the earth by hand. */
  function addMoon(): Planet {
    store.addSatelliteTo(earth);
    const moon = objects.planets().find((p) => p.parent === earth);
    if (!moon) {
      throw new Error('no moon was added');
    }
    return moon;
  }

  describe('tools', () => {
    it('should start with the grab tool and planets to add', () => {
      expect(store.tool()).toBe('grab');
      expect(store.addKind()).toBe('planet');
      expect(store.toolHint()).toBeNull();
    });

    it('should drop what the orbit tool picked when a tool is picked', () => {
      store.pickTool('orbit');
      store.tap(earth);

      store.pickTool('orbit');

      expect(store.orbitTool.parent()).toBeNull();
      expect(store.tool()).toBe('orbit');
    });

    it('should tell what the orbit tool waits for', () => {
      store.pickTool('orbit');
      expect(store.toolHint()).toBe('Tap a body to give it a satellite');

      store.tap(sun);
      expect(store.toolHint()).toContain('add the planet');

      store.pickTool('orbit');
      store.tap(earth);
      expect(store.toolHint()).toContain('add the moon');
    });
  });

  describe('tap', () => {
    it('should follow the body with the grab tool', () => {
      store.tap(earth);

      expect(camera.toggleFollow).toHaveBeenCalledWith(earth);
    });

    it('should open the panel with the select tool', () => {
      store.pickTool('select');

      store.tap(earth);

      expect(store.menuTarget()).toBe(earth);
      expect(clock.suspend).toHaveBeenCalled();
    });

    it('should pick the parent with the orbit tool', () => {
      store.pickTool('orbit');

      store.tap(earth);

      expect(store.orbitTool.parent()).toBe(earth);
    });

    it('should remove a planet, but never the sun, with the delete tool', () => {
      store.pickTool('delete');

      store.tap(sun);
      store.tap(earth);

      expect(objects.worldObjects()).toEqual([sun]);
    });
  });

  describe('panel', () => {
    it('should name its target', () => {
      expect(store.menuTitle()).toBe('');

      store.openMenuFor(sun);
      expect(store.menuTitle()).toBe('Sun');

      store.openMenuFor(earth);
      expect(store.menuTitle()).toBe('Earth');
    });

    it('should call a body put there by hand by its place, a moon a moon', () => {
      const moon: Planet = addMoon();

      expect(store.planetName(moon, 1)).toBe('Moon 2');
      moon.parent = sun;
      expect(store.planetName(moon, 1)).toBe('Planet 2');
    });

    it('should resume the world once closed', () => {
      store.openMenuFor(earth);

      store.menuClosed();

      expect(store.menuTarget()).toBeNull();
      expect(clock.resume).toHaveBeenCalled();
    });

    it('should drop panel and orbit pick on clear', () => {
      store.openMenuFor(earth);
      store.orbitTool.pick(earth);

      store.clear();

      expect(store.menuTarget()).toBeNull();
      expect(store.orbitTool.parent()).toBeNull();
    });

    it('should remove its target, and close with it', () => {
      store.openMenuFor(earth);

      store.removeTarget();

      expect(objects.planets()).toEqual([]);
      expect(store.menuTarget()).toBeNull();
    });

    it('should not remove the sun as its target', () => {
      store.openMenuFor(sun);

      store.removeTarget();

      expect(objects.worldObjects()).toContain(sun);
    });
  });

  describe('edits', () => {
    it('should move the target onto an orbit at the distance, same angle', () => {
      store.openMenuFor(earth);

      store.setDistance(1.5);

      expect(earth.pos.dist(sun.pos)).toBeCloseTo(1.5);
      expect(earth.pos.y).toBeCloseTo(sun.pos.y);
      expect(earth.vel.length()).toBeGreaterThan(0);
    });

    it('should not move the sun to a distance', () => {
      store.openMenuFor(sun);

      store.setDistance(1.5);

      expect(sun.pos).toEqual(vec2(3, 1.8));
    });

    it('should set the mass of a planet', () => {
      store.openMenuFor(earth);

      store.setMass(2 * EARTH_MASS);

      expect(earth.mass).toBe(2 * EARTH_MASS);
    });

    it('should set the mass of the sun in the settings as well', () => {
      store.openMenuFor(sun);

      store.setMass(2);

      expect(sun.mass).toBe(2);
      expect(settings().massOfSun).toBe(2);
    });

    it('should move a moon grown into its planet back onto a valid orbit', () => {
      const moon: Planet = addMoon();
      store.openMenuFor(moon);

      store.setMass(earth.mass);

      const { min } = placementRange(
        earth,
        sun,
        moon.radius,
        GRAVITATIONAL_CONSTANT,
        REACH
      );
      expect(moon.pos.dist(earth.pos)).toBeGreaterThanOrEqual(min - 1e-9);
    });

    it('should set the speed of a moving target in its direction', () => {
      store.openMenuFor(earth);

      store.setSpeed(3);

      expect(earth.vel.length()).toBeCloseTo(3);
      expect(earth.vel.x).toBeCloseTo(0);
      expect(earth.vel.y).toBeLessThan(0);
    });

    it('should send a resting target along its orbit around the sun', () => {
      earth.vel = vec2(0, 0);
      store.openMenuFor(earth);

      store.setSpeed(2);

      expect(earth.vel.length()).toBeCloseTo(2);
      expect(earth.vel.scalar(earth.pos.sub(sun.pos))).toBeCloseTo(0);
    });

    it('should never give the static sun a speed', () => {
      store.openMenuFor(sun);

      store.setSpeed(2);

      expect(sun.vel.length()).toBe(0);
    });
  });

  describe('adding', () => {
    it('should put a body of the kind in hand at the place', () => {
      store.addKind.set('giant');

      const body: Planet = store.placeAt(vec2(1, 1));

      expect(objects.planets()).toContain(body);
      expect(body.mass).toBe(GIANT_MASS);
      expect(body.parent).toBe(sun);
    });

    it('should put a satellite on the orbit asked for', () => {
      store.addSatelliteTo(earth, 0.01, 0);

      const moon = objects.planets().find((p) => p.parent === earth);
      expect(moon?.pos.dist(earth.pos)).toBeCloseTo(0.01);
      expect(moon?.pos.y).toBeCloseTo(earth.pos.y);
    });
  });

  describe('removePlanet', () => {
    it('should hand the moons of a removed planet on to its parent', () => {
      const moon: Planet = addMoon();

      store.removePlanet(earth);

      expect(moon.parent).toBe(sun);
      expect(objects.planets()).toEqual([moon]);
    });

    it('should stop following it, and forget its orbit pick', () => {
      store.orbitTool.pick(earth);

      store.removePlanet(earth);

      expect(camera.forget).toHaveBeenCalledWith(earth);
      expect(store.orbitTool.parent()).toBeNull();
    });

    it('should leave the panel of another body open', () => {
      const moon: Planet = addMoon();
      store.openMenuFor(moon);

      store.removePlanet(earth);

      expect(store.menuTarget()).toBe(moon);
      expect(clock.resume).not.toHaveBeenCalled();
    });
  });
});
