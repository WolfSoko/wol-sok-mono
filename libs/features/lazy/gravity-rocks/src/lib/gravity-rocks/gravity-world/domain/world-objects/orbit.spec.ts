import { vec2 } from '@wolsok/utils-math';
import { GravityWorldService } from '../gravity-world.service';
import {
  defaultOrbitDistance,
  hillRadius,
  minOrbitDistance,
  orbitAround,
  satelliteMass,
} from './orbit';
import { Planet } from './planet';
import { Sun } from './sun';
import { MAX_VELOCITY, WorldObject } from './world-object';

describe('orbitAround', () => {
  const G = 80;

  it('should place the satellite at the given distance and angle', () => {
    const parent = new Sun(vec2(1000, 1000), undefined, 80000);

    const { pos } = orbitAround(parent, 400, 0, G);

    expect(pos).toEqual(vec2(1400, 1000));
    expect(pos.dist(parent.pos)).toBeCloseTo(400, 6);
  });

  it('should give it the speed of a circular orbit', () => {
    const parent = new Sun(vec2(0, 0), undefined, 80000);

    const { vel } = orbitAround(parent, 400, 0, G);

    // v = sqrt(G * M / r)
    expect(vel.length()).toBeCloseTo(Math.sqrt((G * 80000) / 400), 6);
  });

  it('should send it perpendicular to the line towards the parent', () => {
    const parent = new Sun(vec2(0, 0), undefined, 80000);

    for (const angle of [0, 0.7, Math.PI / 2, 2.5, Math.PI, 5.9]) {
      const { pos, vel } = orbitAround(parent, 400, angle, G);
      const radial = pos.sub(parent.pos);
      // a perpendicular pair has a scalar product of zero
      expect(radial.norm().scalar(vel.norm())).toBeCloseTo(0, 6);
    }
  });

  it('should travel along with a moving parent', () => {
    const still = new Planet(vec2(0, 0), undefined, 2000);
    const moving = new Planet(vec2(0, 0), vec2(-100, 40), 2000);

    const aroundStill = orbitAround(still, 300, 1, G);
    const aroundMoving = orbitAround(moving, 300, 1, G);

    expect(aroundMoving.vel).toEqual(aroundStill.vel.add(vec2(-100, 40)));
  });

  it('should slow the orbit down for every pair of objects in the world', () => {
    const parent = new Sun(vec2(0, 0), undefined, 80000);

    const alone = orbitAround(parent, 400, 0, G, 1);
    const crowded = orbitAround(parent, 400, 0, G, 4);

    // the simulation moves an object once per pair, so a circular orbit in a
    // crowded world needs a lower speed
    expect(crowded.vel.length()).toBeCloseTo(alone.vel.length() / 2, 6);
    expect(crowded.pos).toEqual(alone.pos);
  });

  it('should not ask for more speed than the simulation allows', () => {
    const heavy = new Sun(vec2(0, 0), undefined, 1e9);

    // far too close for such a mass, the orbit has to be pushed outwards
    const { pos, vel } = orbitAround(heavy, 1, 0, G);

    expect(vel.length()).toBeLessThanOrEqual(MAX_VELOCITY);
    expect(pos.dist(heavy.pos)).toBe(minOrbitDistance(heavy, G));
  });

  it('should actually orbit in the simulation', () => {
    const service = new GravityWorldService();
    const sun: WorldObject = new Sun(vec2(1500, 900), undefined, 80000);
    service.setUniverse(3000, 1800, G);
    service.addWorldObject(sun);
    // sun and satellite only, so one pair per tick
    const { pos, vel } = orbitAround(sun, defaultOrbitDistance(sun), 0.3, G, 1);
    const satellite: WorldObject = new Planet(pos, vel, satelliteMass(sun));
    service.addWorldObject(satellite);
    const startDistance: number = satellite.pos.dist(sun.pos);

    // a circular orbit keeps its radius, so half a minute of simulated time
    // must not let the satellite fall in or fly away
    for (let step = 0; step < 1800; step++) {
      service.calcNextTick(1 / 60);
      const distance: number = satellite.pos.dist(sun.pos);
      expect(distance).toBeGreaterThan(startDistance * 0.9);
      expect(distance).toBeLessThan(startDistance * 1.1);
    }
    // and it really went around, not just sat there
    expect(satellite.pos.dist(pos)).toBeGreaterThan(startDistance);
  });
});

describe('a moon of a planet', () => {
  const G = 80;

  /** Distance of the moon to its planet after simulating for a while. */
  function simulateMoon(sunDistance: number): {
    start: number;
    samples: number[];
  } {
    const service = new GravityWorldService();
    const sun: WorldObject = new Sun(vec2(0, 0), undefined, 80000);
    service.setUniverse(6000, 6000, G);
    service.addWorldObject(sun);
    // a planet on a circular orbit around the sun
    const planetSpeed: number = Math.sqrt((G * sun.mass) / sunDistance);
    const planet: WorldObject = new Planet(
      vec2(sunDistance, 0),
      vec2(0, -planetSpeed),
      1000
    );
    service.addWorldObject(planet);
    const moonMass: number = satelliteMass(planet);
    const moonRadius: number = new Planet(vec2(0, 0), undefined, moonMass)
      .radius;
    const { pos, vel } = orbitAround(
      planet,
      defaultOrbitDistance(planet, sun, moonRadius),
      Math.PI / 2,
      G,
      // sun, planet and moon: every object pairs up with the two others
      2
    );
    const moon: WorldObject = new Planet(pos, vel, moonMass);
    service.addWorldObject(moon);

    const start: number = moon.pos.dist(planet.pos);
    const samples: number[] = [];
    for (let step = 0; step < 1800; step++) {
      service.calcNextTick(1 / 60);
      if (step % 300 === 0) {
        samples.push(moon.pos.dist(planet.pos));
      }
    }
    return { start, samples };
  }

  it('should stay in orbit around a planet far from the sun', () => {
    const { start, samples } = simulateMoon(2000);

    for (const distance of samples) {
      expect(distance).toBeLessThan(start * 2);
    }
  });

  it('should be stolen by the sun close to it', () => {
    // documents the limit of this world: a planet is drawn far bigger than its
    // mass deserves, so a moon that does not overlap its planet sits outside
    // the hill radius when the planet itself orbits close to the sun
    const { start, samples } = simulateMoon(450);

    expect(samples[samples.length - 1]).toBeGreaterThan(start * 2);
  });
});

describe('satellite defaults', () => {
  it('should keep a satellite well clear of its parent', () => {
    const parent = new Planet(vec2(0, 0), undefined, 2000);
    expect(defaultOrbitDistance(parent)).toBeGreaterThan(parent.radius * 2);
    expect(defaultOrbitDistance(parent, undefined, 500)).toBeGreaterThan(
      parent.radius + 500
    );
  });

  it('should keep a moon inside the reach of its planet', () => {
    const sun = new Sun(vec2(0, 0), undefined, 80000);
    const planet = new Planet(vec2(450, 0), undefined, 1000);
    const hill = hillRadius(planet, sun);

    const distance = defaultOrbitDistance(planet, sun);

    // the wide default would put the moon outside the hill radius, where the
    // sun takes over, so the moon is pulled in to where it stays bound
    expect(planet.radius * 4).toBeGreaterThan(hill);
    expect(distance).toBeLessThan((planet.radius * 4) / 2);
    expect(distance).toBeLessThan(hill / 2);
    expect(distance).toBeGreaterThan(planet.radius);
  });

  it('should keep the discs apart even when that breaks the orbit', () => {
    const sun = new Sun(vec2(0, 0), undefined, 80000);
    // drawn far bigger than its mass deserves, its hill radius is tiny
    const feather = new Planet(vec2(450, 0), undefined, 40);
    const moonRadius = 12;

    const distance = defaultOrbitDistance(feather, sun, moonRadius);

    expect(distance).toBeGreaterThan(feather.radius + moonRadius);
    expect(distance).toBeGreaterThan(hillRadius(feather, sun) * 0.4);
  });

  it('should use the wide distance when the hill radius allows it', () => {
    const sun = new Sun(vec2(0, 0), undefined, 80000);
    const heavyFarOut = new Planet(vec2(20000, 0), undefined, 40000);

    expect(defaultOrbitDistance(heavyFarOut, sun)).toBe(heavyFarOut.radius * 4);
  });

  it('should ignore a primary for the sun itself', () => {
    const sun = new Sun(vec2(0, 0), undefined, 80000);
    expect(defaultOrbitDistance(sun)).toBe(sun.radius * 4);
    expect(defaultOrbitDistance(sun, sun)).toBe(sun.radius * 4);
  });

  it('should make a planet of the sun and a moon of a planet', () => {
    const sun = new Sun(vec2(0, 0), undefined, 80000);
    const planet = new Planet(vec2(0, 0), undefined, 1000);

    expect(satelliteMass(sun)).toBe(4000);
    expect(satelliteMass(planet)).toBe(50);
  });

  it('should never make a satellite smaller than the minimum', () => {
    const tiny = new Planet(vec2(0, 0), undefined, 1);
    expect(satelliteMass(tiny)).toBe(30);
  });
});
