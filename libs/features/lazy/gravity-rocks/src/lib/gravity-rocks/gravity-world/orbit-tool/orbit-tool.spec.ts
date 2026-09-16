import { computed, signal, WritableSignal } from '@angular/core';
import { vec2, Vector2d } from '@wolsok/utils-math';
import { GRAVITATIONAL_CONSTANT } from '../domain/solar-system';
import {
  placementRange,
  satelliteRadiusFor,
} from '../domain/world-objects/orbit';
import { Planet } from '../domain/world-objects/planet';
import { Sun } from '../domain/world-objects/sun';
import { WorldObject } from '../domain/world-objects/world-object';
import { OrbitTool } from './orbit-tool';

describe('OrbitTool', () => {
  const sun: Sun = new Sun(vec2(3, 1.8), undefined, 1);
  let planet: Planet;
  let bodies: WritableSignal<readonly WorldObject[]>;
  let tool: OrbitTool;

  beforeEach(() => {
    planet = new Planet(vec2(4, 1.8), undefined, 3e-6);
    planet.parent = sun;
    bodies = signal([sun, planet]);
    tool = new OrbitTool({
      sun: () => sun,
      bodies,
      gravitationalConstant: computed(() => GRAVITATIONAL_CONSTANT),
      reach: computed(() => 3),
    });
  });

  it('should draw nothing before a body is picked', () => {
    expect(tool.preview()).toBeNull();
    expect(tool.isHeld).toBe(false);
  });

  it('should draw an orbit around the body it was given', () => {
    tool.pick(planet);

    const preview = tool.preview();
    expect(preview?.center).toBe(planet.pos);
    expect(preview?.radius).toBeGreaterThan(0);
  });

  /** An orbit the planet really offers, halfway through what it can do. */
  function reachableOrbit(): number {
    const { min, max } = placementRange(
      planet,
      sun,
      satelliteRadiusFor(planet),
      GRAVITATIONAL_CONSTANT,
      3
    );
    return (min + max) / 2;
  }

  it('should take the orbit out to where the pointer is', () => {
    const wanted: number = reachableOrbit();
    tool.pick(planet);
    tool.grab(1, planet.pos.add(vec2(wanted, 0)));

    expect(tool.isHeldBy(1)).toBe(true);
    expect(tool.preview()?.radius).toBeCloseTo(wanted, 6);
    expect(tool.preview()?.angle).toBeCloseTo(0, 6);
  });

  it('should keep the orbit within what the body can offer', () => {
    tool.pick(planet);
    // a hundred AU out, far past anything the planet keeps or the world holds
    tool.moveTo(planet.pos.add(vec2(100, 0)));
    const far: number = tool.preview()?.radius ?? 0;

    tool.moveTo(planet.pos);
    const near: number = tool.preview()?.radius ?? 0;

    expect(far).toBeLessThan(100);
    expect(near).toBeLessThan(far);
    expect(near).toBeGreaterThan(planet.radius);
  });

  it('should mark an orbit the body is too light to keep', () => {
    // an earth a whole AU from the sun keeps nothing clear of its own disc,
    // which is drawn a thousand times wider than the earth really is
    tool.pick(planet);
    tool.moveTo(planet.pos.add(vec2(reachableOrbit(), 0)));
    expect(tool.preview()?.held).toBe(false);

    // a tenth of a sun, three AU out where its grip reaches far past its own
    // disc, holds on to the orbits it offers
    planet.mass = 0.1;
    planet.pos = sun.pos.add(vec2(3, 0));
    bodies.set([sun, planet]);
    tool.moveTo(planet.pos.add(vec2(reachableOrbit(), 0)));

    expect(tool.preview()?.held).toBe(true);
  });

  it('should draw the orbit around the body where it is now', () => {
    tool.pick(planet);
    planet.pos = vec2(5, 1.8);
    bodies.set([sun, planet]);

    expect(tool.preview()?.center).toEqual(vec2(5, 1.8));
  });

  it('should report the orbit to place a satellite on when let go', () => {
    const wanted: number = reachableOrbit();
    tool.pick(planet);
    tool.grab(1, planet.pos.add(vec2(wanted, 0)));

    const placed = tool.release(planet.pos.add(vec2(0, wanted)));

    expect(placed?.parent).toBe(planet);
    expect(placed?.orbit.radius).toBeCloseTo(wanted, 6);
    expect(placed?.orbit.angle).toBeCloseTo(Math.PI / 2, 6);
  });

  it('should forget the pointer on release, a mouse keeps its id', () => {
    tool.pick(planet);
    tool.grab(1, planet.pos.add(vec2(reachableOrbit(), 0)));
    tool.release(planet.pos.add(vec2(reachableOrbit(), 0)));

    // the very next press has to look like a new one, not the same hold
    expect(tool.isHeld).toBe(false);
    expect(tool.isHeldBy(1)).toBe(false);
  });

  it('should keep the body but drop the hold when a gesture is cut short', () => {
    tool.pick(planet);
    tool.grab(1, planet.pos.add(vec2(reachableOrbit(), 0)));

    tool.letGo();

    expect(tool.isHeld).toBe(false);
    expect(tool.parent()).toBe(planet);
  });

  it('should drop everything when it is cleared', () => {
    tool.pick(planet);
    tool.grab(1, planet.pos.add(vec2(reachableOrbit(), 0)));

    tool.clear();

    expect(tool.parent()).toBeNull();
    expect(tool.preview()).toBeNull();
    expect(tool.isHeld).toBe(false);
  });

  it('should forget a body that has left the world, and only that one', () => {
    tool.pick(planet);

    tool.forget(sun);
    expect(tool.parent()).toBe(planet);

    tool.forget(planet);
    expect(tool.parent()).toBeNull();
  });

  it('should place a satellite anywhere on the circle before it is dragged', () => {
    tool.pick(sun);

    const preview = tool.preview();
    const offset: Vector2d = (preview?.satellite ?? vec2(0, 0)).sub(sun.pos);
    expect(offset.length()).toBeCloseTo(preview?.radius ?? 0, 6);
  });
});
