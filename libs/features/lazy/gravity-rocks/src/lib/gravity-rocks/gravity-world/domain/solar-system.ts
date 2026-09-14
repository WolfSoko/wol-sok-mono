/**
 * The world runs on real astronomy, in the units astronomers use for it:
 * distances in astronomical units, time in years, mass in solar masses.
 *
 * That choice is what keeps the numbers workable. In SI the same simulation
 * would carry 2e30 kg next to 1.5e11 m and a gravitational constant of
 * 6.7e-11, and every product of the three would be a step away from the
 * precision a double has to spare. Here the sun weighs 1, the earth orbits at
 * 1, a year is 1 - and the gravitational constant is no longer a knob someone
 * picked, it follows from the earth taking one year to go round:
 *
 *     G = 4π²  AU³ / (M☉ · year²)
 *
 * Sizes are a different matter. Drawn to scale the sun would be half a pixel
 * across and the earth invisible, so `displayRadius` stretches them - see
 * there for what it keeps and what it gives up.
 */

/**
 * Gravitational constant in AU³ / (M☉ · year²). It is 4π² - that is what the
 * earth taking one year over one AU comes to - kept to the four decimals the
 * settings field shows, so the number a person reads there and the number the
 * world runs on are the same one. What that costs is a year out by a
 * ten-millionth, which nothing in here can tell apart.
 */
export const GRAVITATIONAL_CONSTANT = 39.4784;

/** Mass of the earth in solar masses. */
export const EARTH_MASS = 3.0035e-6;
/** Radius of the sun in AU, the yardstick every drawn size is measured by. */
export const SUN_RADIUS = 4.6524e-3;
/** Radius of the earth in AU. */
export const EARTH_RADIUS = 4.2635e-5;

/** A body of the solar system, as it really is. */
export interface CelestialBody {
  readonly name: string;
  /** Mass in solar masses. */
  readonly mass: number;
  /** Radius of the body itself in AU, not the radius it is drawn with. */
  readonly radius: number;
  /** Semi-major axis of its orbit in AU. */
  readonly orbit: number;
}

/**
 * The sun and the planets that fit into a window a few AU wide. Masses and
 * radii are the real ones; the orbits are the semi-major axes, so a planet
 * placed on one and given its circular speed travels a near enough circle.
 */
export const SUN: CelestialBody = {
  name: 'Sun',
  mass: 1,
  radius: SUN_RADIUS,
  orbit: 0,
};

export const PLANETS: readonly CelestialBody[] = [
  { name: 'Mercury', mass: 1.6601e-7, radius: 1.631e-5, orbit: 0.3871 },
  { name: 'Venus', mass: 2.4478e-6, radius: 4.0453e-5, orbit: 0.7233 },
  { name: 'Earth', mass: EARTH_MASS, radius: EARTH_RADIUS, orbit: 1.0 },
  { name: 'Mars', mass: 3.2271e-7, radius: 2.2661e-5, orbit: 1.5237 },
];

/** The bodies the world starts with, by the name each carries as its id. */
export const PLANET_NAMES: ReadonlySet<string> = new Set(
  PLANETS.map(({ name }) => name)
);

/** Radius the sun is drawn with, in AU. Everything else follows from it. */
const SUN_DISPLAY_RADIUS = 0.15;
/**
 * How flat the drawn sizes are pressed together. The cube root turns the
 * sun's real 109 earth radii into a fivefold difference: far from true, but
 * a sun that dominates the view, planets that differ visibly from each other,
 * and none of them smaller than a few pixels.
 */
const DISPLAY_RADIUS_EXPONENT = 1 / 3;
/** Density every body placed by hand is assumed to have: the earth's. */
const EARTH_DENSITY_RADIUS = EARTH_RADIUS / EARTH_MASS ** (1 / 3);

/**
 * Radius to draw a body of the given real radius with, in AU.
 *
 * To scale, a sun 0.005 AU across in a window six AU wide is a single pixel,
 * and a planet is nothing at all. Stretching the sizes is what makes the
 * world worth looking at; what it costs is that a planet's disc no longer
 * says anything about the distances it keeps - only about how the bodies
 * compare to each other, and that order is kept exactly.
 */
export function displayRadius(bodyRadius: number): number {
  if (bodyRadius <= 0) {
    return 0;
  }
  return (
    SUN_DISPLAY_RADIUS * (bodyRadius / SUN_RADIUS) ** DISPLAY_RADIUS_EXPONENT
  );
}

/**
 * Radius of a body of the given mass in AU, taking it to be as dense as the
 * earth. A world object carries no radius of its own - a planet placed by
 * hand is a mass and nothing else - so this is where one comes from.
 */
export function radiusOfMass(mass: number): number {
  return mass > 0 ? EARTH_DENSITY_RADIUS * mass ** (1 / 3) : 0;
}

/** Speed a body needs to circle `centralMass` at `distance`, in AU/year. */
export function circularOrbitSpeed(
  centralMass: number,
  distance: number
): number {
  if (distance <= 0) {
    return 0;
  }
  return Math.sqrt((GRAVITATIONAL_CONSTANT * centralMass) / distance);
}
