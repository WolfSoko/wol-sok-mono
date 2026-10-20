/**
 * The layouts of the reactor: a core in the middle, fuel rods around it.
 * Point symmetric like every other map - one half laid out, the other
 * mirrored from it by {@link pointSymmetric}.
 */

import { GameMap, pointSymmetric, Rect } from './maps';
import { blob } from './shapes';

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

/** The reactor's layouts, in the order the levels use them. */
export const REACTOR_MAPS: readonly GameMap[] = [reactorCore];
