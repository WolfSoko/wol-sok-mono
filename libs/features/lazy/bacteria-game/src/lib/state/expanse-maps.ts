/**
 * The layouts bigger than the base arena - `size` times it along each side,
 * laid out on that bigger base. The camera follows the colony across them.
 */

import { seeded } from './geometry';
import { GameMap, pointSymmetric } from './maps';
import { hexLattice } from './shapes';

/** Where Expanse keeps room for its neutral colonies, as shares. */
export const EXPANSE_NEUTRALS = [
  { x: 0.5, y: 0.22 },
  { x: 0.5, y: 0.78 },
] as const;

/**
 * Open country four times the base arena, strewn with rocks - and two
 * clearings for the neutral colonies between the start spots.
 */
const expanse: GameMap = {
  id: 'expanse',
  name: 'Expanse',
  description: 'Four times the room, strewn with rocks. Find the enemy.',
  size: 2,
  createWalls(width, height) {
    const clearing = Math.min(width, height) * 0.14;
    const rocks = hexLattice(seeded(20), width, height, {
      spacing: Math.round(height * 0.17),
      jitter: 0.6,
      fill: 0.16,
      spread: 0.14,
      skip: 0.45,
    }).filter((rock) =>
      EXPANSE_NEUTRALS.every(
        (spot) =>
          Math.hypot(
            rock.x + rock.width / 2 - spot.x * width,
            rock.y + rock.height / 2 - spot.y * height
          ) >
          clearing + rock.width / 2
      )
    );
    return pointSymmetric(rocks, width, height);
  },
};

/** The big layouts, in the order the levels use them. */
export const EXPANSE_MAPS: readonly GameMap[] = [expanse];
