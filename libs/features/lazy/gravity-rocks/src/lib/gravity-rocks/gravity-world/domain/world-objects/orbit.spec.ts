import { vec2 } from '@wolsok/utils-math';
import { GravityWorldService } from '../gravity-world.service';
import { EARTH_MASS, GRAVITATIONAL_CONSTANT, PLANETS } from '../solar-system';
import {
  defaultOrbitDistance,
  hillRadius,
  keepsSatelliteAt,
  minOrbitDistance,
  orbitAround,
  orbitDistanceRange,
  placedPlanetMass,
  satelliteMass,
  STABLE_HILL_FRACTION,
} from './orbit';
import { Planet } from './planet';
import { Sun } from './sun';
import { MAX_VELOCITY, WorldObject } from './world-object';

/** The world runs in AU, years and solar masses - see `solar-system.ts`. */
const G = GRAVITATIONAL_CONSTANT;
const SUN_MASS = 1;
const JUPITER_MASS = 9.5458e-4;
/** A step small enough for the inner planets, as the component uses. */
const TICK_YEARS = 0.001;

describe('orbitAround', () => {
  it('should place the satellite at the given distance and angle', () => {
    const parent = new Sun(vec2(3, 1.8), undefined, SUN_MASS);

    const { pos } = orbitAround(parent, 1, 0, G);

    expect(pos).toEqual(vec2(4, 1.8));
    expect(pos.dist(parent.pos)).toBeCloseTo(1, 6);
  });

  it('should give it the speed of a circular orbit', () => {
    const parent = new Sun(vec2(0, 0), undefined, SUN_MASS);

    const { vel } = orbitAround(parent, 1, 0, G);

    // v = sqrt(G * M / r), which at one AU around one sun is 2π AU a year -
    // to the four decimals G is kept to
    expect(vel.length()).toBeCloseTo(Math.sqrt((G * SUN_MASS) / 1), 12);
    expect(vel.length()).toBeCloseTo(2 * Math.PI, 5);
  });

  it('should send it perpendicular to the line towards the parent', () => {
    const parent = new Sun(vec2(0, 0), undefined, SUN_MASS);

    for (const angle of [0, 0.7, Math.PI / 2, 2.5, Math.PI, 5.9]) {
      const { pos, vel } = orbitAround(parent, 1, angle, G);
      const radial = pos.sub(parent.pos);
      // a perpendicular pair has a scalar product of zero
      expect(radial.norm().scalar(vel.norm())).toBeCloseTo(0, 6);
    }
  });

  it('should travel along with a moving parent', () => {
    const still = new Planet(vec2(0, 0), undefined, JUPITER_MASS);
    const moving = new Planet(vec2(0, 0), vec2(-2, 0.8), JUPITER_MASS);

    const aroundStill = orbitAround(still, 0.3, 1, G);
    const aroundMoving = orbitAround(moving, 0.3, 1, G);

    expect(aroundMoving.vel).toEqual(aroundStill.vel.add(vec2(-2, 0.8)));
  });

  it('should not carry the velocity of a static parent', () => {
    const still = new Sun(vec2(0, 0), undefined, SUN_MASS);
    const drifting = new Sun(vec2(0, 0), vec2(4, 0), SUN_MASS);

    // a static object does not move, so nothing of its velocity is inherited
    expect(orbitAround(drifting, 1, 0, G).vel).toEqual(
      orbitAround(still, 1, 0, G).vel
    );
  });

  it('should budget for the velocity it carries from a moving parent', () => {
    const fast = new Planet(vec2(0, 0), vec2(MAX_VELOCITY - 20, 0), SUN_MASS);

    const { vel } = orbitAround(fast, 1e-6, 0, G);

    // the orbital part plus the carried part must stay within the cap, or the
    // integrator renormalises the velocity and the orbit is lost
    expect(vel.length()).toBeLessThanOrEqual(MAX_VELOCITY);
    expect(minOrbitDistance(fast, G, MAX_VELOCITY - 20)).toBeGreaterThan(
      minOrbitDistance(fast, G, 0)
    );
  });

  it('should not ask for more speed than the simulation allows', () => {
    const heavy = new Sun(vec2(0, 0), undefined, 1000 * SUN_MASS);

    // far too close for such a mass, the orbit has to be pushed outwards
    const { pos, vel } = orbitAround(heavy, 1e-6, 0, G);

    expect(vel.length()).toBeLessThanOrEqual(MAX_VELOCITY);
    expect(pos.dist(heavy.pos)).toBe(minOrbitDistance(heavy, G));
  });

  it('should actually orbit in the simulation', () => {
    const service = new GravityWorldService();
    const sun: WorldObject = new Sun(vec2(3, 1.8), undefined, SUN_MASS);
    service.setUniverse(6, 3.6, G);
    service.addWorldObject(sun);
    const { pos, vel } = orbitAround(sun, 1, 0.3, G);
    const satellite: WorldObject = new Planet(pos, vel, EARTH_MASS);
    service.addWorldObject(satellite);
    const startDistance: number = satellite.pos.dist(sun.pos);

    // a year and a half of world time: an orbit at one AU keeps its radius
    for (let step = 0; step < 1500; step++) {
      service.calcNextTick(TICK_YEARS);
      const distance: number = satellite.pos.dist(sun.pos);
      expect(distance).toBeGreaterThan(startDistance * 0.9);
      expect(distance).toBeLessThan(startDistance * 1.1);
    }
    // and it really went around, not just sat there
    expect(satellite.pos.dist(pos)).toBeGreaterThan(startDistance);
  });

  it('should hold the orbits of the inner planets for years', () => {
    const service = new GravityWorldService();
    const sun: WorldObject = new Sun(vec2(0, 0), undefined, SUN_MASS);
    service.setUniverse(12, 12, G);
    service.addWorldObject(sun);
    const planets: WorldObject[] = PLANETS.map((body, index) => {
      const { pos, vel } = orbitAround(sun, body.orbit, index, G);
      return new Planet(pos, vel, body.mass);
    });
    planets.forEach((planet) => service.addWorldObject(planet));

    // five years: twenty laps for mercury, the one the tick has least room
    // for, and the one an integrator that leaks energy carries away first
    for (let step = 0; step < 5000; step++) {
      service.calcNextTick(TICK_YEARS);
    }

    planets.forEach((planet, index) => {
      const { orbit } = PLANETS[index];
      expect(planet.pos.dist(sun.pos)).toBeGreaterThan(orbit * 0.95);
      expect(planet.pos.dist(sun.pos)).toBeLessThan(orbit * 1.05);
    });
  });

  it('should take a year for the orbit the earth is on', () => {
    const service = new GravityWorldService();
    const sun: WorldObject = new Sun(vec2(0, 0), undefined, SUN_MASS);
    service.setUniverse(6, 3.6, G);
    service.addWorldObject(sun);
    const { pos, vel } = orbitAround(sun, 1, 0, G);
    const earth: WorldObject = new Planet(pos, vel, EARTH_MASS);
    service.addWorldObject(earth);

    // half a year in, it must be on the far side of the sun
    for (let step = 0; step < 500; step++) {
      service.calcNextTick(TICK_YEARS);
    }
    expect(earth.pos.dist(pos)).toBeCloseTo(2, 1);

    // and after the other half it is near where it started again: a leapfrog
    // of a thousand steps a lap comes back a few percent of the way around,
    // which is close enough for a year to be a year
    for (let step = 0; step < 500; step++) {
      service.calcNextTick(TICK_YEARS);
    }
    expect(earth.pos.dist(pos)).toBeLessThan(0.3);
  });
});

describe('a moon of a planet', () => {
  /** Distance of the moon to its planet after simulating for a while. */
  function simulateMoon(
    planetMass: number,
    sunDistance: number,
    years = 2
  ): { start: number; samples: number[] } {
    const service = new GravityWorldService();
    const sun: WorldObject = new Sun(vec2(0, 0), undefined, SUN_MASS);
    service.setUniverse(24, 24, G);
    service.addWorldObject(sun);
    // a planet on a circular orbit around the sun
    const planetSpeed: number = Math.sqrt((G * sun.mass) / sunDistance);
    const planet: WorldObject = new Planet(
      vec2(sunDistance, 0),
      vec2(0, -planetSpeed),
      planetMass
    );
    service.addWorldObject(planet);
    const moonMass: number = satelliteMass(planet);
    const moonRadius: number = new Planet(vec2(0, 0), undefined, moonMass)
      .radius;
    const { pos, vel } = orbitAround(
      planet,
      defaultOrbitDistance(planet, sun, moonRadius),
      Math.PI / 2,
      G
    );
    const moon: WorldObject = new Planet(pos, vel, moonMass);
    service.addWorldObject(moon);

    const start: number = moon.pos.dist(planet.pos);
    const samples: number[] = [];
    const steps: number = Math.round(years / TICK_YEARS);
    for (let step = 0; step < steps; step++) {
      service.calcNextTick(TICK_YEARS);
      if (step % 400 === 0) {
        samples.push(moon.pos.dist(planet.pos));
      }
    }
    return { start, samples };
  }

  it('should stay in orbit around a planet heavy enough to hold it', () => {
    // jupiter out at five AU reaches far enough that a moon clear of its disc
    // is still well inside its grip
    const { start, samples } = simulateMoon(JUPITER_MASS, 5.2);

    for (const distance of samples) {
      expect(distance).toBeLessThan(start * 2);
    }
  });

  it('should be stolen by the sun from a planet too light to keep it', () => {
    // documents what real masses cost this world: the earth's grip reaches
    // 0.014 AU, and it is drawn with a radius of 0.031, so a moon clear of
    // its disc is already the sun's. Raising its mass is what fixes that.
    const { start, samples } = simulateMoon(EARTH_MASS, 1, 5);

    // not an orbit at all - the sun swings it about, far past where it began
    expect(Math.max(...samples)).toBeGreaterThan(start * 2);
  });
});

describe('satellite defaults', () => {
  it('should keep a satellite well clear of its parent', () => {
    const parent = new Planet(vec2(0, 0), undefined, JUPITER_MASS);
    expect(defaultOrbitDistance(parent)).toBeGreaterThan(parent.radius * 2);
    expect(defaultOrbitDistance(parent, undefined, 0.05)).toBeGreaterThan(
      parent.radius + 0.05
    );
  });

  it('should keep a moon inside the reach of its planet', () => {
    const sun = new Sun(vec2(0, 0), undefined, SUN_MASS);
    // out here the sun still decides how far a moon of jupiter may sit, but
    // leaves it room enough to clear the planet's disc
    const jupiter = new Planet(vec2(5.2, 0), undefined, JUPITER_MASS);
    const hill = hillRadius(jupiter, sun);

    const distance = defaultOrbitDistance(jupiter, sun);

    // the wide default would put the moon past the part of the hill radius
    // where it stays bound, so it is pulled in to where it does
    expect(jupiter.radius * 4).toBeGreaterThan(hill * STABLE_HILL_FRACTION);
    expect(distance).toBeLessThan(jupiter.radius * 4);
    expect(distance).toBeCloseTo(hill * STABLE_HILL_FRACTION, 6);
    expect(distance).toBeGreaterThan(jupiter.radius);
  });

  it('should keep the discs apart even when that breaks the orbit', () => {
    const sun = new Sun(vec2(0, 0), undefined, SUN_MASS);
    // drawn far bigger than its mass deserves, its hill radius is tiny
    const feather = new Planet(vec2(0.7, 0), undefined, EARTH_MASS / 100);
    const moonRadius = 0.02;

    const distance = defaultOrbitDistance(feather, sun, moonRadius);

    expect(distance).toBeGreaterThan(feather.radius + moonRadius);
    expect(distance).toBeGreaterThan(
      hillRadius(feather, sun) * STABLE_HILL_FRACTION
    );
  });

  it('should use the wide distance when the hill radius allows it', () => {
    const sun = new Sun(vec2(0, 0), undefined, SUN_MASS);
    const heavyFarOut = new Planet(vec2(200, 0), undefined, 0.05 * SUN_MASS);

    expect(defaultOrbitDistance(heavyFarOut, sun)).toBe(heavyFarOut.radius * 4);
  });

  it('should ignore a primary for the sun itself', () => {
    const sun = new Sun(vec2(0, 0), undefined, SUN_MASS);
    expect(defaultOrbitDistance(sun)).toBe(sun.radius * 4);
    expect(defaultOrbitDistance(sun, sun)).toBe(sun.radius * 4);
  });

  it('should make a planet of the sun and a moon of a planet', () => {
    const sun = new Sun(vec2(0, 0), undefined, SUN_MASS);
    const jupiter = new Planet(vec2(0, 0), undefined, JUPITER_MASS);

    // a thousandth of the sun is about what jupiter really is
    expect(satelliteMass(sun)).toBeCloseTo(1e-3, 9);
    expect(satelliteMass(sun) / EARTH_MASS).toBeCloseTo(333, 0);
    expect(satelliteMass(jupiter)).toBeCloseTo(JUPITER_MASS / 1000, 12);
  });

  it('should never make a satellite smaller than the minimum', () => {
    const tiny = new Planet(vec2(0, 0), undefined, 1e-9);
    expect(satelliteMass(tiny)).toBe(1e-8);
  });

  describe('mass of a planet placed by hand', () => {
    /** Mass in earth masses, which is how a person reads one. */
    const inEarths = (mass: number): number => mass / EARTH_MASS;

    it('should grow with the sun it will circle', () => {
      // the same share of a ten times heavier sun is ten times the planet
      expect(placedPlanetMass(1, 0)).toBeCloseTo(1 / 333000, 12);
      expect(placedPlanetMass(10, 0)).toBeCloseTo(10 / 333000, 12);
    });

    it('should span from an earth to a jupiter', () => {
      expect(inEarths(placedPlanetMass(1, 0))).toBeCloseTo(1, 1);
      expect(inEarths(placedPlanetMass(1, 1))).toBeCloseTo(333, 0);
      expect(placedPlanetMass(1, 1)).toBeCloseTo(JUPITER_MASS, 4);
    });

    it('should stay a body next to a tiny sun', () => {
      expect(placedPlanetMass(1e-6, 0)).toBe(1e-8);
    });

    it('should keep a share out of range within it', () => {
      expect(placedPlanetMass(1, -1)).toBe(placedPlanetMass(1, 0));
      expect(placedPlanetMass(1, 2)).toBe(placedPlanetMass(1, 1));
    });

    it('should pick its own share when none is given', () => {
      const mass = placedPlanetMass(1);
      expect(mass).toBeGreaterThanOrEqual(1 / 333000);
      expect(mass).toBeLessThanOrEqual(1 / 1000);
    });
  });

  describe('range a satellite may be placed in', () => {
    it('should start where the two discs clear each other', () => {
      const sun = new Sun(vec2(0, 0), undefined, SUN_MASS);
      const moonRadius = 0.03;

      const { min } = orbitDistanceRange(sun, undefined, moonRadius);

      expect(min).toBe(sun.radius * 1.2 + moonRadius);
    });

    it('should end where the primary would steal the satellite', () => {
      const sun = new Sun(vec2(0, 0), undefined, SUN_MASS);
      // far enough out that jupiter's grip reaches well past its disc
      const jupiter = new Planet(vec2(30, 0), undefined, JUPITER_MASS);
      const held = hillRadius(jupiter, sun) * STABLE_HILL_FRACTION;
      expect(held).toBeGreaterThan(jupiter.radius * 4);

      const { max } = orbitDistanceRange(jupiter, sun);

      expect(max).toBeCloseTo(held, 6);
    });

    it('should offer the usual few radii even past where the primary steals', () => {
      const sun = new Sun(vec2(0, 0), undefined, SUN_MASS);
      // at 5.2 AU the sun lets jupiter keep less than four of its radii
      const jupiter = new Planet(vec2(5.2, 0), undefined, JUPITER_MASS);
      const held = hillRadius(jupiter, sun) * STABLE_HILL_FRACTION;
      expect(held).toBeLessThan(jupiter.radius * 4);

      const { min, max } = orbitDistanceRange(jupiter, sun);

      expect(min).toBeLessThan(held);
      expect(max).toBe(jupiter.radius * 4);
      expect(keepsSatelliteAt(jupiter, sun, held)).toBe(true);
      expect(keepsSatelliteAt(jupiter, sun, max)).toBe(false);
    });

    it('should not shrink to nothing as the grip falls to the disc', () => {
      const sun = new Sun(vec2(0, 0), undefined, SUN_MASS);
      // ever lighter planets at one place: the range must not pinch shut
      // where the hill radius crosses the disc clearance
      let previous = Number.POSITIVE_INFINITY;
      for (let exponent = 3; exponent >= -3; exponent -= 0.05) {
        const planet = new Planet(
          vec2(5.2, 0),
          undefined,
          EARTH_MASS * 10 ** exponent
        );
        const { min, max } = orbitDistanceRange(planet, sun, 0, 3);
        expect(max - min).toBeGreaterThanOrEqual(planet.radius * 2.8 - 1e-9);
        // and the far end only ever comes in as the planet gets lighter
        expect(max).toBeLessThanOrEqual(previous + 1e-9);
        previous = max;
      }
    });

    it('should reach as far as it is allowed to without a primary', () => {
      const sun = new Sun(vec2(0, 0), undefined, SUN_MASS);

      expect(orbitDistanceRange(sun, undefined, 0, 3).max).toBe(3);
      // the sun is no primary of its own
      expect(orbitDistanceRange(sun, sun, 0, 3).max).toBe(3);
    });

    it('should stay inside the reach even when the primary is far away', () => {
      // a sun this light barely holds on to anything, so the hill radius of a
      // planet orbiting it reaches beyond the world
      const featherSun = new Sun(vec2(0, 0), undefined, EARTH_MASS);
      const planet = new Planet(vec2(20, 0), undefined, EARTH_MASS);
      expect(
        hillRadius(planet, featherSun) * STABLE_HILL_FRACTION
      ).toBeGreaterThan(3);

      expect(orbitDistanceRange(planet, featherSun, 0, 3).max).toBe(3);
    });

    it('should start no closer than the floor it is given', () => {
      const sun = new Sun(vec2(0, 0), undefined, SUN_MASS);
      const { min: withoutFloor } = orbitDistanceRange(sun, undefined, 0, 3);

      const { min, max } = orbitDistanceRange(sun, undefined, 0, 3, 0.5);

      expect(withoutFloor).toBeLessThan(0.5);
      expect(min).toBe(0.5);
      expect(max).toBeGreaterThanOrEqual(min);
    });

    it('should offer a few radii where the primary takes everything anyway', () => {
      const sun = new Sun(vec2(0, 0), undefined, SUN_MASS);
      // drawn far bigger than its mass deserves, and right next to the sun
      const feather = new Planet(vec2(0.4, 0), undefined, EARTH_MASS / 1000);

      const { min, max } = orbitDistanceRange(feather, sun);

      // no orbit it can offer is one it keeps, so it offers the usual ones
      expect(hillRadius(feather, sun) * STABLE_HILL_FRACTION).toBeLessThan(min);
      expect(min).toBeLessThan(max);
      expect(max).toBe(feather.radius * 4);
      expect(keepsSatelliteAt(feather, sun, min)).toBe(false);
      expect(keepsSatelliteAt(feather, sun, max)).toBe(false);
    });

    it('should still stay inside the reach where the primary takes everything', () => {
      const sun = new Sun(vec2(0, 0), undefined, SUN_MASS);
      const feather = new Planet(vec2(0.4, 0), undefined, EARTH_MASS / 1000);
      const reach = feather.radius * 2;

      const { min, max } = orbitDistanceRange(feather, sun, 0, reach);

      expect(max).toBe(Math.max(min, reach));
      expect(max).toBeLessThan(feather.radius * 4);
    });

    it('should tell an orbit the parent keeps from one the primary takes', () => {
      const sun = new Sun(vec2(0, 0), undefined, SUN_MASS);
      const jupiter = new Planet(vec2(5.2, 0), undefined, JUPITER_MASS);
      const held = hillRadius(jupiter, sun) * STABLE_HILL_FRACTION;

      expect(keepsSatelliteAt(jupiter, sun, held * 0.9)).toBe(true);
      expect(keepsSatelliteAt(jupiter, sun, held * 1.1)).toBe(false);
      // the sun has no primary, so it keeps whatever circles it
      expect(keepsSatelliteAt(sun, undefined, 1000)).toBe(true);
      expect(keepsSatelliteAt(sun, sun, 1000)).toBe(true);
    });

    it('should hold the distance a satellite is placed at by default', () => {
      const sun = new Sun(vec2(0, 0), undefined, SUN_MASS);
      const jupiter = new Planet(vec2(5.2, 0), undefined, JUPITER_MASS);

      for (const [parent, primary] of [
        [sun, undefined],
        [jupiter, sun],
      ] as const) {
        const { min, max } = orbitDistanceRange(parent, primary, 0, 3);
        const fallback = defaultOrbitDistance(parent, primary);
        expect(fallback).toBeGreaterThanOrEqual(min);
        expect(fallback).toBeLessThanOrEqual(max);
      }
    });
  });
});

describe('a planet born with a radius of its own', () => {
  const earth = PLANETS[2];

  it('should keep that radius at the mass it came with', () => {
    const planet = new Planet(
      vec2(0, 0),
      undefined,
      earth.mass,
      'Earth',
      earth.radius
    );

    expect(planet.bodyRadius).toBe(earth.radius);
    // and not what the earth's density would make of its own mass, which is
    // the same thing here, but for jupiter would not be
    const jupiter = new Planet(
      vec2(0, 0),
      undefined,
      JUPITER_MASS,
      'j',
      4.7789e-4
    );
    expect(jupiter.bodyRadius).toBe(4.7789e-4);
  });

  it('should grow and shrink with the mass it is given', () => {
    const planet = new Planet(
      vec2(0, 0),
      undefined,
      earth.mass,
      'Earth',
      earth.radius
    );
    const wasDrawn = planet.radius;

    planet.mass = earth.mass * 8;

    // eight times the mass at the same density is twice the radius, and the
    // drawn disc follows it - or a planet set to three suns would still be
    // drawn the size of the earth, and offer a moon the orbits of one
    expect(planet.bodyRadius).toBeCloseTo(earth.radius * 2, 12);
    expect(planet.radius).toBeGreaterThan(wasDrawn);
  });

  it('should not pretend to a radius it never had', () => {
    const placed = new Planet(vec2(0, 0), undefined, earth.mass);

    // placed by hand, so it is sized from its mass like anything else
    expect(placed.bodyRadius).toBeCloseTo(earth.radius, 6);
    placed.mass = earth.mass * 8;
    expect(placed.bodyRadius).toBeCloseTo(earth.radius * 2, 6);
  });
});

describe('the solar system the world starts with', () => {
  it('should carry the real masses of its planets', () => {
    const [mercury, , earth] = PLANETS;

    expect(earth.name).toBe('Earth');
    expect(mercury.name).toBe('Mercury');
    expect(earth.mass).toBe(EARTH_MASS);
    // the earth is a third of a millionth of the sun, mercury a twentieth
    // of the earth
    expect(earth.mass).toBeCloseTo(1 / 333000, 9);
    expect(mercury.mass / earth.mass).toBeCloseTo(0.0553, 3);
    expect(earth.orbit).toBe(1);
  });
});
