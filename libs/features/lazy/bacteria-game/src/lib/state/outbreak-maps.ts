/**
 * The layouts of the outbreak, where the bosses live. Point symmetric like
 * every other map - one half laid out, the other mirrored from it by
 * {@link pointSymmetric} - with room round both start spots for a boss's
 * colony.
 */

import { GameMap, pointSymmetric, Rect } from './maps';

/**
 * A quarantine ward: rows of beds across the middle and aisles between
 * them - a front that breaks up into lanes.
 */
const ward: GameMap = {
  id: 'ward',
  name: 'Ward',
  description: 'Rows of beds across the middle, aisles between them.',
  createWalls(width, height) {
    const beds: Rect[] = [];
    const bedWidth = Math.round(width * 0.06);
    const bedHeight = Math.round(height * 0.12);
    for (const row of [0.08, 0.32]) {
      beds.push({
        x: Math.round(width * 0.42),
        y: Math.round(height * row),
        width: bedWidth,
        height: bedHeight,
      });
    }
    beds.push({
      x: Math.round(width * 0.47),
      y: Math.round(height * 0.2),
      width: bedWidth,
      height: bedHeight,
    });
    return pointSymmetric(beds, width, height);
  },
};

/** The outbreak's layouts, in the order the levels use them. */
export const OUTBREAK_MAPS: readonly GameMap[] = [ward];
