import { Vector2d } from '@wolsok/utils-math';
import { MAX_VELOCITY, WorldObject } from './world-object';

/** Distance of a new satellite from its parent, in parent radii. */
const ORBIT_DISTANCE_IN_RADII = 4;
/** Gap kept between the discs of parent and satellite, in parent radii. */
const MIN_GAP_IN_RADII = 0.2;
/**
 * Share of the hill radius a satellite may use and still stay bound. The hill
 * radius is where the primary wins outright; a satellite has to stay well
 * inside it, because the primary pulls on its orbit long before that. A
 * quarter holds: simulated over twenty years a moon of jupiter placed there
 * stays within a third of where it started, while one a third of the way out
 * is four times as far away inside ten.
 */
export const STABLE_HILL_FRACTION = 0.25;
/**
 * Mass of a new satellite, as a fraction of its parent's mass. A thousandth
 * is what jupiter is to the sun; our moon is ten times more than that to the
 * earth, so this errs towards a satellite that is plainly the smaller of the
 * two - which is what a planet of a sun and a moon of a planet both are.
 */
const SATELLITE_MASS_RATIO = 1 / 1000;
/** Nothing smaller than a large moon, in solar masses. */
const MIN_SATELLITE_MASS = 1e-8;
/**
 * Mass of a planet placed by hand, as a fraction of the sun it will circle:
 * from about an earth to about a jupiter.
 */
const PLACED_MASS_MIN_RATIO = 1 / 333000;
const PLACED_MASS_MAX_RATIO = 1 / 1000;
/** Speed a satellite may always spend on its orbit, however fast its parent. */
const MIN_SPEED_BUDGET = 0.1;

/**
 * Where a satellite has to start, and how fast, to circle its parent once
 * placed `distance` away from it at `angle` radians. The parent's own velocity
 * is added on top, so a satellite of a moving planet travels along with it.
 *
 * A circular orbit is `v = sqrt(G * parentMass / distance)`, the same formula
 * the world itself runs on - see `circularOrbitSpeed`.
 */
export function orbitAround(
  parent: WorldObject,
  distance: number,
  angle: number,
  gravitationalConstant: number
): { pos: Vector2d; vel: Vector2d } {
  // a static parent stays where it is, whatever velocity it carries around
  const carried: Vector2d = parent.isStatic ? Vector2d.zero : parent.vel;
  const radius: number = Math.max(
    distance,
    minOrbitDistance(parent, gravitationalConstant, carried.length())
  );
  const outwards: Vector2d = Vector2d.create(Math.cos(angle), Math.sin(angle));
  const speed: number = Math.sqrt(
    (gravitationalConstant * parent.mass) / radius
  );
  return {
    pos: parent.pos.add(outwards.mul(radius)),
    // a circular orbit runs perpendicular to the line towards the parent
    vel: Vector2d.create(outwards.y, -outwards.x).mul(speed).add(carried),
  };
}

/**
 * Closest a satellite can orbit before it would have to outrun `MAX_VELOCITY`,
 * which the simulation caps - it would renormalise the velocity and turn the
 * orbit into a crash. The satellite also carries its parent's velocity, and in
 * the worst case both point the same way, so that speed is budgeted for too.
 */
export function minOrbitDistance(
  parent: WorldObject,
  gravitationalConstant: number,
  carriedSpeed = 0
): number {
  const budget: number = Math.max(
    MIN_SPEED_BUDGET,
    MAX_VELOCITY - Math.abs(carriedSpeed)
  );
  return (gravitationalConstant * parent.mass) / budget ** 2;
}

/**
 * Distance at which a satellite of the given parent is placed.
 *
 * Four parent radii, but never so far out that the `primary` the parent itself
 * orbits would pull the satellite away: beyond the hill radius the satellite
 * belongs to the primary, not to the parent, and drifts off.
 *
 * The two discs must not overlap either, and that wins when the two rules
 * disagree. A light planet is drawn far bigger than its mass deserves, so its
 * hill radius can be smaller than its own disc - such a planet only ever gets
 * a moon the sun will eventually steal. Raising the planet's mass fixes that.
 */
export function defaultOrbitDistance(
  parent: WorldObject,
  primary?: WorldObject,
  satelliteRadius = 0
): number {
  const wide: number = parent.radius * ORBIT_DISTANCE_IN_RADII;
  const clearance: number = clearanceDistance(parent, satelliteRadius);
  if (!holdsSatellitesFor(parent, primary)) {
    return Math.max(clearance, wide);
  }
  const stable: number = hillRadius(parent, primary) * STABLE_HILL_FRACTION;
  return Math.max(clearance, Math.min(wide, stable));
}

/**
 * How far from its parent a satellite may be placed: from the two discs just
 * clearing each other - or `floor`, whichever is further out - to where the
 * `primary` would steal it, and never beyond `reach`.
 *
 * `floor` is what `orbitAround` would push a satellite out to anyway, so an
 * orbit offered below it would not be the one that is placed.
 *
 * The usual few radii are offered whatever the primary allows, so the range
 * never shrinks to nothing: a light planet is drawn far bigger than its mass
 * deserves, and then every orbit clear of its disc is one the primary
 * eventually takes over - but a slider with nothing to choose looks broken,
 * and one that froze just before the planet's grip fell to its disc would
 * look worse. Where the satellite is lost anyway it may as well be lost from
 * where it was asked for; ask `keepsSatelliteAt` which orbits are kept.
 */
export function orbitDistanceRange(
  parent: WorldObject,
  primary: WorldObject | undefined,
  satelliteRadius = 0,
  reach = Number.POSITIVE_INFINITY,
  floor = 0
): { min: number; max: number } {
  const min: number = Math.max(
    clearanceDistance(parent, satelliteRadius),
    floor
  );
  const outer: number = holdsSatellitesFor(parent, primary)
    ? // a satellite beyond the world is as lost as one the primary takes
      Math.min(hillRadius(parent, primary) * STABLE_HILL_FRACTION, reach)
    : reach;
  const wide: number = parent.radius * ORBIT_DISTANCE_IN_RADII;
  return { min, max: Math.max(min, Math.min(Math.max(outer, wide), reach)) };
}

/**
 * Whether a satellite `distance` from its parent is one the parent keeps -
 * rather than one the `primary` the parent orbits pulls away in time.
 */
export function keepsSatelliteAt(
  parent: WorldObject,
  primary: WorldObject | undefined,
  distance: number
): boolean {
  return (
    !holdsSatellitesFor(parent, primary) ||
    distance <= hillRadius(parent, primary) * STABLE_HILL_FRACTION
  );
}

/** Closest the two discs can be without overlapping. */
function clearanceDistance(
  parent: WorldObject,
  satelliteRadius: number
): number {
  return parent.radius * (1 + MIN_GAP_IN_RADII) + satelliteRadius;
}

/** Whether `primary` is a body the parent orbits, and so has to share with. */
function holdsSatellitesFor(
  parent: WorldObject,
  primary?: WorldObject
): primary is WorldObject {
  return !!primary && primary !== parent && primary.mass > 0;
}

/**
 * Reach of the parent's own gravity while it orbits the primary. Satellites
 * further out than this are pulled away by the primary.
 */
export function hillRadius(parent: WorldObject, primary: WorldObject): number {
  return parent.pos.dist(primary.pos) * Math.cbrt(parent.mass / primary.mass);
}

/**
 * Mass for a satellite of the given parent: small enough to be a moon of a
 * planet, or a planet of the sun.
 */
export function satelliteMass(parent: WorldObject): number {
  return Math.max(MIN_SATELLITE_MASS, parent.mass * SATELLITE_MASS_RATIO);
}

/**
 * Mass for a planet placed by hand, so that it stays a planet next to the sun
 * however heavy that sun is set to be: a fraction of it, picked by `share`
 * (0 to 1) out of the range a planet may have.
 */
export function placedPlanetMass(
  sunMass: number,
  share = Math.random()
): number {
  const ratio: number =
    PLACED_MASS_MIN_RATIO +
    Math.min(Math.max(share, 0), 1) *
      (PLACED_MASS_MAX_RATIO - PLACED_MASS_MIN_RATIO);
  return Math.max(MIN_SATELLITE_MASS, sunMass * ratio);
}
