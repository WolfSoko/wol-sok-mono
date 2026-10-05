import { vec2, Vector2d } from '@wolsok/utils-math';
import { circularOrbitSpeed, PLANETS } from './solar-system';
import { Planet } from './world-objects/planet';
import { Sun } from './world-objects/sun';

/**
 * The sun and the inner planets, ready to be put into a world: each planet on
 * its real orbit with the speed that orbit takes, spread out so no two of
 * them start in a row. Mercury through mars - the ones that fit in the frame.
 *
 * Kept out of `solar-system.ts` because that file is what a world object is
 * sized by, and a body may not size itself by a file that builds bodies.
 */
export function createSolarSystem(
  center: Vector2d,
  massOfSun: number,
  gravitationalConstant: number
): { sun: Sun; planets: Planet[] } {
  const sun: Sun = new Sun(center, undefined, massOfSun);
  const planets: Planet[] = PLANETS.map((body, index) => {
    // an eighth of a turn between neighbours, so no two of them line up
    const angle: number = (index * Math.PI) / 4;
    const outwards: Vector2d = vec2(Math.cos(angle), Math.sin(angle));
    const speed: number = circularOrbitSpeed(
      massOfSun,
      body.orbit,
      gravitationalConstant
    );
    const planet: Planet = new Planet(
      center.add(outwards.mul(body.orbit)),
      // a circular orbit runs perpendicular to the line to the sun
      vec2(outwards.y, -outwards.x).mul(speed),
      body.mass,
      body.name,
      body.radius
    );
    planet.parent = sun;
    return planet;
  });
  return { sun, planets };
}
