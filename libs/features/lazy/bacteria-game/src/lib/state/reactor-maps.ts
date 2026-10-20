/**
 * The layouts of the reactor: a core in the middle, fuel rods around it.
 * Point symmetric like every other map - one half laid out, the other
 * mirrored from it by {@link pointSymmetric}.
 */

import { GameMap, pointSymmetric, Rect } from './maps';
import { blob } from './shapes';
import { Zone, ZoneKind } from './zones';

/** A round zone around a point - see {@link blob}. */
function disc(kind: ZoneKind, x: number, y: number, radius: number): Zone {
  return { ...blob(x, y, radius), kind };
}

/** The fuel rods of the left half, as shares of the arena. */
const RODS = [
  { x: 0.36, y: 0.1, length: 0.24 },
  { x: 0.36, y: 0.66, length: 0.24 },
  { x: 0.14, y: 0.08, length: 0.18 },
  { x: 0.24, y: 0.78, length: 0.14 },
] as const;

/**
 * A round core in the middle with rods standing around it: the colonies
 * meet on either side of the core, and the rods break up the flanks.
 */
const reactorCore: GameMap = {
  id: 'reactor-core',
  name: 'Reactor Core',
  description: 'A core in the middle and fuel rods around it.',
  createWalls(width, height) {
    const thickness = 6;
    const rods: Rect[] = RODS.map((rod) => ({
      x: Math.round(width * rod.x),
      y: Math.round(height * rod.y),
      width: thickness,
      height: Math.round(height * rod.length),
    }));
    // The core is its own mirror image, so it is left out of the mirroring.
    return [
      ...pointSymmetric(rods, width, height),
      blob(width / 2, height / 2, height * 0.13),
    ];
  },
};

/**
 * The containment hall: rich agar in the middle, worth fighting for, and
 * a strip of antibiotic along each flank that punishes going round. Ice
 * slows the way back to the start, and the heat by the middle sends a
 * colony at the enemy harder.
 */
const containment: GameMap = {
  id: 'containment',
  name: 'Containment',
  description: 'Agar in the middle, antibiotic on the flanks.',
  createWalls(width, height) {
    const thickness = 6;
    return pointSymmetric(
      [
        {
          x: Math.round(width * 0.4),
          y: Math.round(height * 0.16),
          width: thickness,
          height: Math.round(height * 0.18),
        },
        {
          x: Math.round(width * 0.2),
          y: Math.round(height * 0.72),
          width: Math.round(width * 0.1),
          height: thickness,
        },
      ],
      width,
      height
    );
  },
  createZones(width, height) {
    return pointSymmetric(
      [
        disc('agar', width / 2, height / 2, height * 0.16),
        {
          kind: 'antibiotic',
          x: Math.round(width * 0.18),
          y: 0,
          width: Math.round(width * 0.2),
          height: Math.round(height * 0.14),
        },
        {
          kind: 'ice',
          x: Math.round(width * 0.04),
          y: Math.round(height * 0.3),
          width: Math.round(width * 0.08),
          height: Math.round(height * 0.4),
        },
        disc('heat', width * 0.4, height * 0.72, height * 0.09),
      ],
      width,
      height
    );
  },
};

/**
 * The control room: the zone to hold in the middle, behind four shields
 * with gaps between them - a colony has to come through one to take it.
 */
const controlRoom: GameMap = {
  id: 'control-room',
  name: 'Control Room',
  description: 'A zone to hold in the middle, behind four shields.',
  createWalls(width, height) {
    const thickness = 6;
    const reach = Math.round(height * 0.3);
    return pointSymmetric(
      [
        // Left of the zone, and above it - their mirrors close the ring.
        {
          x: Math.round(width / 2 - reach),
          y: Math.round(height / 2 - reach * 0.55),
          width: thickness,
          height: Math.round(reach * 1.1),
        },
        {
          x: Math.round(width / 2 - reach * 0.55),
          y: Math.round(height / 2 - reach),
          width: Math.round(reach * 1.1),
          height: thickness,
        },
      ],
      width,
      height
    );
  },
  createZones(width, height) {
    return [disc('hill', width / 2, height / 2, height * 0.16)];
  },
};

/** The reactor's layouts, in the order the levels use them. */
export const REACTOR_MAPS: readonly GameMap[] = [
  reactorCore,
  containment,
  controlRoom,
];
