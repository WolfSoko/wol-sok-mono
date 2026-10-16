import { Vector2d } from '@wolsok/utils-math';
import { EARTH_MASS } from '../domain/solar-system';
import { placedPlanetMass, satelliteMass } from '../domain/world-objects/orbit';
import { Planet } from '../domain/world-objects/planet';
import { WorldObject } from '../domain/world-objects/world-object';
import { ObjectKind } from '../toolbelt/tools';

/**
 * A thousandth of an earth, the lightest the mass slider goes; a jupiter, at
 * 318 earths; and a star weighs whatever the sun is set to.
 */
export const ASTEROID_MASS = EARTH_MASS / 1000;
export const GIANT_MASS = EARTH_MASS * 318;

/** Mass a body of the given kind is put down with, in solar masses. */
export function massOfKind(kind: ObjectKind, massOfSun: number): number {
  switch (kind) {
    case 'asteroid':
      return ASTEROID_MASS;
    case 'giant':
      return GIANT_MASS;
    case 'star':
      return massOfSun;
    default:
      // a planet keeps its place next to the sun however heavy that is set
      return placedPlanetMass(massOfSun);
  }
}

/** A body of the given kind at the given world position, circling `sun`. */
export function createBodyAt(
  pos: Vector2d,
  kind: ObjectKind,
  sun: WorldObject,
  massOfSun: number
): Planet {
  const planet: Planet = new Planet(
    pos,
    undefined,
    massOfKind(kind, massOfSun)
  );
  planet.parent = sun;
  return planet;
}

/** The satellite `parent` would be given: its moon, or its planet. */
export function createSatelliteFor(parent: WorldObject): Planet {
  const satellite: Planet = new Planet(
    parent.pos,
    undefined,
    satelliteMass(parent)
  );
  satellite.parent = parent;
  return satellite;
}
