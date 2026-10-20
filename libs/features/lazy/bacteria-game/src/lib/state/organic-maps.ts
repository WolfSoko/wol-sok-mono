/**
 * The organic layouts: walls that grow, bubble, beat and sway like living
 * tissue instead of being laid out with a ruler.
 *
 * They are built from round walls - overlapping blobs - and follow the same
 * rule as every other map: point symmetric, one half generated (from a fixed
 * seed, so a level always looks the same) and the other mirrored from it by
 * {@link pointSymmetric}. Nothing grows into the spots the colonies start on.
 */

import { seeded, wrap } from './geometry';
import { blob, growThread, hexLattice } from './shapes';
import { DynamicWall, GameMap, pointSymmetric, Rect } from './maps';

/** A round wall that is part of a living, moving layout. */
function movingBlob(x: number, y: number, radius: number): DynamicWall {
  const wall = blob(x, y, radius) as DynamicWall;
  wall.solid = true;
  wall.warning = 0;
  return wall;
}

/**
 * Air sacs of every size, packed like the inside of a lung. The colonies
 * squeeze through the channels between them - there is no straight line
 * anywhere.
 */
const alveoli: GameMap = {
  id: 'alveoli',
  name: 'Alveoli',
  description: 'Packed air sacs with winding channels between them.',
  createWalls(width, height) {
    return pointSymmetric(
      hexLattice(seeded(7), width, height, {
        spacing: height / 4.2,
        jitter: 0.3,
        fill: 0.22,
        spread: 0.14,
      }),
      width,
      height
    );
  },
};

/**
 * Fungal threads that grow in from the top and the bottom edge, wander and
 * branch - a maze nobody planned.
 */
const mycelium: GameMap = {
  id: 'mycelium',
  name: 'Mycelium',
  description: 'Branching threads grow in from both edges - a living maze.',
  createWalls(width, height) {
    const random = seeded(11);
    const threads = 6;
    const blobs: Rect[] = [];
    for (let i = 0; i < threads; i++) {
      growThread(random, blobs, width, height, {
        x:
          (width * (i + 0.5)) / threads +
          (random() - 0.5) * (width / threads) * 0.4,
        y: -2,
        angle: Math.PI / 2 + (random() - 0.5) * 0.6,
        radius: 4 + random() * 2,
        length: height * (0.38 + random() * 0.14),
      });
    }
    return pointSymmetric(blobs, width, height);
  },
};

/**
 * Seconds from one heartbeat to the next. The music of the level kicks on
 * the same beats - see `LEVEL_MUSIC`.
 */
export const HEART_PERIOD_SEC = 1.6;

/** Where in a heartbeat its two beats fall, and how long each swells. */
const HEART = { lub: 0, dub: 0.25, width: 0.06 };

/**
 * How far the heart is contracted at that match time, from 0 to 1: a strong
 * beat and a softer one right after it, then a rest - lub-dub.
 */
export function heartbeat(timeSec: number): number {
  const phase = wrap(timeSec, HEART_PERIOD_SEC) / HEART_PERIOD_SEC;
  const pulse = (at: number) => {
    // Distance around the cycle, so the beat on 0 swells in before it.
    const off = Math.abs(phase - at);
    return Math.exp(-((Math.min(off, 1 - off) / HEART.width) ** 2));
  };
  return Math.max(pulse(HEART.lub), 0.65 * pulse(HEART.dub));
}

/**
 * Two curved membranes around a heart in the middle. The heart and its
 * smaller valves swell with every beat and shove away whatever sits on them.
 */
const heartbeatMap: GameMap = {
  id: 'heartbeat',
  name: 'Heartbeat',
  description: 'Chambers that swell with every beat and shove the colonies.',
  createWalls(width, height) {
    // An arc of small blobs left of the centre; its mirror closes the
    // other side, with the openings at the top and the bottom.
    const blobs: Rect[] = [];
    const radius = height * 0.26;
    for (let degrees = 130; degrees <= 230; degrees += 6) {
      const angle = (degrees * Math.PI) / 180;
      blobs.push(
        blob(
          width / 2 + Math.cos(angle) * radius * 1.1,
          height / 2 + Math.sin(angle) * radius,
          4
        )
      );
    }
    return pointSymmetric(blobs, width, height);
  },
  createDynamicWalls(width, height, timeSec) {
    // The beat runs outwards from the heart: each valve a moment later.
    return pointSymmetric(
      [
        movingBlob(width / 2, height / 2, 9 + 12 * heartbeat(timeSec)),
        movingBlob(width / 2, height * 0.13, 6 + 7 * heartbeat(timeSec - 0.08)),
        movingBlob(
          width * 0.2,
          height * 0.17,
          5 + 6 * heartbeat(timeSec - 0.16)
        ),
      ],
      width,
      height
    );
  },
};

/** The swaying fingers of the villi: how many, how deep and how fast. */
const VILLI = { count: 6, depth: 0.34, swing: 9, periodSec: 3.2, step: 4 };

/**
 * The lining of a gut: soft fingers hang in from the top and the bottom edge
 * and sway in a slow wave, sweeping the colonies along.
 */
const villi: GameMap = {
  id: 'villi',
  name: 'Villi',
  description: 'Swaying fingers sweep in from both edges.',
  createWalls: () => [],
  createDynamicWalls(width, height, timeSec) {
    const { count, depth, swing, periodSec, step } = VILLI;
    const length = height * depth;
    const blobs: DynamicWall[] = [];
    for (let i = 0; i < count; i++) {
      const baseX = (width * (i + 0.5)) / count;
      for (let d = 0; d <= length; d += step) {
        const along = d / length;
        // Rooted at the edge, swinging most at the tip, a wave running down.
        const sway =
          swing *
          along *
          Math.sin((2 * Math.PI * timeSec) / periodSec + i * 0.9 - along * 1.5);
        // A finger with a rounded, slightly swollen tip.
        const radius = along > 0.9 ? 5 : 6 - along * 2;
        blobs.push(movingBlob(baseX + sway, d, radius));
      }
    }
    return pointSymmetric(blobs, width, height);
  },
};

/** The organic layouts, in the order the levels use them. */
export const ORGANIC_MAPS: readonly GameMap[] = [
  alveoli,
  mycelium,
  heartbeatMap,
  villi,
];
