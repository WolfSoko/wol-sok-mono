import { vec2 } from '@wolsok/utils-math';
import { EARTH_MASS } from '../domain/solar-system';
import { placedPlanetMass, satelliteMass } from '../domain/world-objects/orbit';
import { Planet } from '../domain/world-objects/planet';
import { Sun } from '../domain/world-objects/sun';
import {
  ASTEROID_MASS,
  createBodyAt,
  createSatelliteFor,
  GIANT_MASS,
  massOfKind,
} from './body-factory';

describe('body factory', () => {
  afterEach(() => jest.restoreAllMocks());

  const sun: Sun = new Sun(vec2(3, 1.8), undefined, 1);

  describe('massOfKind', () => {
    it('should weigh an asteroid a thousandth of an earth', () => {
      expect(massOfKind('asteroid', 1)).toBe(EARTH_MASS / 1000);
      expect(ASTEROID_MASS).toBe(EARTH_MASS / 1000);
    });

    it('should weigh a giant like jupiter', () => {
      expect(massOfKind('giant', 1)).toBe(EARTH_MASS * 318);
      expect(GIANT_MASS).toBe(EARTH_MASS * 318);
    });

    it('should weigh a star like the sun is set to', () => {
      expect(massOfKind('star', 2.5)).toBe(2.5);
    });

    it('should weigh a planet so it keeps its place next to the sun', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.5);

      expect(massOfKind('planet', 2)).toBe(placedPlanetMass(2, 0.5));
    });
  });

  describe('createBodyAt', () => {
    it('should put the body where asked, at rest, around the sun', () => {
      const body: Planet = createBodyAt(vec2(1, 2), 'giant', sun, 1);

      expect(body.pos.x).toBe(1);
      expect(body.pos.y).toBe(2);
      expect(body.vel.length()).toBe(0);
      expect(body.mass).toBe(GIANT_MASS);
      expect(body.parent).toBe(sun);
    });
  });

  describe('createSatelliteFor', () => {
    it('should start the satellite on its parent with the mass it allows', () => {
      const planet: Planet = new Planet(vec2(4, 1.8), undefined, EARTH_MASS);

      const moon: Planet = createSatelliteFor(planet);

      expect(moon.pos).toEqual(planet.pos);
      expect(moon.mass).toBe(satelliteMass(planet));
      expect(moon.parent).toBe(planet);
    });
  });
});
