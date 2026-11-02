/**
 * The layouts bigger than the base arena - `size` times it along each side,
 * laid out on that bigger base. The camera follows the colony across them.
 *
 * The layouts after Expanse are drawn on that bigger base, 640 x 360 cells,
 * and stretched with the arena they are asked for. Point symmetric like
 * every other map: one half laid out, the other mirrored by
 * {@link pointSymmetric}.
 */

import { distance, Point, seeded, wrap } from './geometry';
import { GameMap, pointSymmetric, Rect, rectCenter } from './maps';
import { heartbeat } from './organic-maps';
import { blob, growThread, hexLattice, movingBlob, nearSpawn } from './shapes';
import { disc, puddle, Zone } from './zones';

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
          distance(rectCenter(rock), {
            x: spot.x * width,
            y: spot.y * height,
          }) >
          clearing + rock.width / 2
      )
    );
    return pointSymmetric(rocks, width, height);
  },
};

/** The base the layouts below are drawn on, in cells: two base arenas a side. */
const BIG = { width: 640, height: 360 } as const;

/**
 * The drawing board of a big layout on an arena of that size: points and
 * lengths given on {@link BIG}, stretched to the arena.
 */
function board(width: number, height: number) {
  const sx = width / BIG.width;
  const sy = height / BIG.height;
  return {
    x: (x: number) => x * sx,
    y: (y: number) => y * sy,
    /** A length - a radius - grown with the arena's height. */
    r: (r: number) => r * sy,
  };
}

/**
 * The points every `step` cells along a line from `from` to `to`, swung off
 * it by a sine wave `wobble` cells high - a wall or a channel that grew
 * rather than was drawn with a ruler.
 */
function wavyLine(
  from: Point,
  to: Point,
  step: number,
  wobble: number,
  waveLength: number
): Point[] {
  const length = distance(from, to);
  const count = Math.max(1, Math.round(length / step));
  // The normal of the line, which the wave swings along.
  const nx = -(to.y - from.y) / length;
  const ny = (to.x - from.x) / length;
  const points: Point[] = [];
  for (let i = 0; i <= count; i++) {
    const along = i / count;
    const swing =
      wobble * Math.sin((2 * Math.PI * along * length) / waveLength);
    points.push({
      x: from.x + (to.x - from.x) * along + nx * swing,
      y: from.y + (to.y - from.y) * along + ny * swing,
    });
  }
  return points;
}

/** True when the point keeps that far from both start spots. */
function clearOfSpawns(
  { x, y }: Point,
  reach: number,
  width: number,
  height: number
): boolean {
  return !nearSpawn(x, y, reach, width, height, 0);
}

/**
 * Archipelago: islands in a sea of antibiotic. A channel cuts each start
 * island off from the middle, crossed by two narrow bridges far from the
 * enemy; a ring of it moats the island in the middle - the zone to hold -
 * with a bridge in from the north and one from the south.
 */
const archipelago: GameMap = {
  id: 'archipelago',
  name: 'Archipelago',
  description: 'Islands in antibiotic, narrow bridges, a zone in the middle.',
  size: 2,
  createWalls(width, height) {
    const { x, y, r } = board(width, height);
    // Reefs: rocks on the islands to break a front up - none on a bridge.
    const reefs = [
      [62, 52, 13],
      [96, 300, 16],
      [36, 196, 10],
      [270, 34, 12],
      [282, 316, 11],
      [258, 178, 9],
      [370, 120, 8],
    ];
    return pointSymmetric(
      reefs.map(([cx, cy, radius]) => blob(x(cx), y(cy), r(radius))),
      width,
      height
    );
  },
  createZones(width, height) {
    const { x, y, r } = board(width, height);
    const sea: Zone[] = [];
    // The channel off the left start island, from edge to edge, with a
    // bridge across it a third down and one a third up - its mirror holds
    // the bridges at the same heights.
    // Disc centres skipped - the discs' radius narrows each to ~22 cells.
    const bridges = [
      [38, 94],
      [266, 322],
    ];
    for (const point of wavyLine(
      { x: 232, y: -8 },
      { x: 232, y: BIG.height + 8 },
      7,
      7,
      120
    )) {
      if (bridges.some(([top, bottom]) => point.y > top && point.y < bottom)) {
        continue;
      }
      sea.push(disc('antibiotic', x(point.x), y(point.y), r(15)));
    }
    // The moat round the middle island, the left half of it: open to the
    // north and the south, where the bridges come in. It runs into the
    // channels, so the land north and south of it are islands of their
    // own, reached from both start islands.
    const moat = 62;
    for (let degrees = 90 + 24; degrees <= 270 - 24; degrees += 7) {
      const angle = (degrees * Math.PI) / 180;
      sea.push(
        disc(
          'antibiotic',
          x(BIG.width / 2 + Math.cos(angle) * moat),
          y(BIG.height / 2 + Math.sin(angle) * moat),
          r(13)
        )
      );
    }
    // Lagoons in the corners of the start islands.
    sea.push(...puddle('antibiotic', x(40), y(330), r(30), r(18), 21));
    sea.push(...puddle('antibiotic', x(150), y(22), r(36), r(16), 22));
    return [
      ...pointSymmetric(sea, width, height),
      disc('hill', x(BIG.width / 2), y(BIG.height / 2), r(30)),
    ];
  },
};

/**
 * How far a valve of the bloodstream is open at that match time, from 0 to
 * 1: shut down to a slit, opening over a second, open, closing again - the
 * cycle shifted by `offsetSec`.
 */
export function valveOpening(timeSec: number, offsetSec = 0): number {
  const { periodSec, shutSec, swingSec } = VALVE;
  const phase = wrap(timeSec + offsetSec, periodSec);
  const openSec = periodSec - shutSec - 2 * swingSec;
  if (phase < shutSec) {
    return 0;
  }
  if (phase < shutSec + swingSec) {
    return (phase - shutSec) / swingSec;
  }
  if (phase < shutSec + swingSec + openSec) {
    return 1;
  }
  return Math.max(0, 1 - (phase - shutSec - swingSec - openSec) / swingSec);
}

/** The bloodstream's valves: how long a cycle is, shut, and swinging. */
const VALVE = { periodSec: 10, shutSec: 3.5, swingSec: 1 };

/** Where the wall above the middle vessel runs, and how thick it is. */
const VESSEL_WALL = { y: 105, radius: 15 } as const;

/**
 * The valves in the wall above the middle vessel - their mirrors sit in the
 * wall below it: the wall's blobs skipped from x to x, which leaves a gap
 * some 70 cells wide, and when in the cycle each one opens. The two take
 * turns.
 */
const VALVES = [
  { from: 20, to: 120, offsetSec: 0 },
  { from: 390, to: 490, offsetSec: VALVE.periodSec / 2 },
] as const;

/**
 * How wide a shut valve still leaves its gap, in cells: wide enough for the
 * bots' grid to see it open, so their way through never comes and goes.
 */
const VALVE_SLIT = 24;

/**
 * Bloodstream: three vessels side by side. The colonies start in the
 * middle one, facing each other across a heart that beats and squeezes
 * the way past it; valves in the vessel walls let them out into the outer
 * vessels, where the long ways round run - hot by the heart, icy at the
 * far ends, throbbing with every beat.
 */
const bloodstream: GameMap = {
  id: 'bloodstream',
  name: 'Bloodstream',
  description: 'Three vessels, a beating heart, valves that open and shut.',
  size: 2,
  createWalls(width, height) {
    const { x, y, r } = board(width, height);
    const tissue: Rect[] = [];
    // The wall above the middle vessel, with the valves' gaps - its mirror
    // is the wall below it.
    for (const point of wavyLine(
      { x: -8, y: VESSEL_WALL.y },
      { x: BIG.width + 8, y: VESSEL_WALL.y },
      8,
      5,
      90
    )) {
      if (VALVES.some((valve) => point.x > valve.from && point.x < valve.to)) {
        continue;
      }
      tissue.push(blob(x(point.x), y(point.y), r(VESSEL_WALL.radius)));
    }
    // The outer wall of the vessel above, along the top edge.
    for (const point of wavyLine({ x: 60, y: 4 }, { x: 600, y: 4 }, 8, 5, 90)) {
      tissue.push(blob(x(point.x), y(point.y), r(20)));
    }
    return [
      ...pointSymmetric(tissue, width, height),
      // The heart's core in the middle is its own mirror image.
      blob(x(BIG.width / 2), y(BIG.height / 2), r(20)),
    ];
  },
  createDynamicWalls(width, height, timeSec) {
    const { x, y, r } = board(width, height);
    // A valve's two flaps swell from either side of its gap until only a
    // slit is left, and shrink back into the wall to let the blood through.
    // Never quite shut: a way that comes and goes would send the colonies
    // back and forth between it and the long way round.
    const flaps = VALVES.flatMap((valve) => {
      const shut = 1 - valveOpening(timeSec, valve.offsetSec);
      const left = valve.from + VESSEL_WALL.radius;
      const right = valve.to - VESSEL_WALL.radius;
      const flap = r(4 + ((right - left - VALVE_SLIT) / 2 - 4) * shut);
      return [
        movingBlob(x(left), y(VESSEL_WALL.y), flap),
        movingBlob(x(right), y(VESSEL_WALL.y), flap),
      ];
    });
    // Constrictions of the outer vessels, beating with the heart, each a
    // moment after the one before.
    const pulse = (at: number) => r(8 + 16 * heartbeat(timeSec - at));
    return [
      ...pointSymmetric(
        [
          ...flaps,
          movingBlob(x(178), y(24), pulse(0.1)),
          movingBlob(x(430), y(24), pulse(0.25)),
        ],
        width,
        height
      ),
      // The heart swells with every beat and squeezes the ways past it -
      // never shut, or the colonies would turn back for the long way.
      movingBlob(
        x(BIG.width / 2),
        y(BIG.height / 2),
        r(20 + 12 * heartbeat(timeSec))
      ),
    ];
  },
  createZones(width, height) {
    const { x, y, r } = board(width, height);
    return pointSymmetric(
      [
        // Hot blood above the heart, ice at the far end of the vessel.
        ...puddle('heat', x(320), y(56), r(54), r(22), 23),
        ...puddle('ice', x(40), y(52), r(32), r(26), 24),
      ],
      width,
      height
    );
  },
};

/** Where Root Network keeps its neutral colonies, as shares. */
export const ROOT_NETWORK_NEUTRALS = [
  { x: 0.5, y: 0.17 },
  { x: 0.5, y: 0.83 },
] as const;

/**
 * Root Network: a cave of rock pillars, overgrown by fungal threads from
 * both edges. Two hollows in the middle keep a grey colony each, pockets of
 * agar lie along the way.
 */
const rootNetwork: GameMap = {
  id: 'root-network',
  name: 'Root Network',
  description: 'A cave of pillars and threads, hollows with grey colonies.',
  size: 2,
  createWalls(width, height) {
    const { x, y, r } = board(width, height);
    // The threads grow over the whole width, so the hollows are kept free
    // on both halves before the mirroring.
    const hollows = [
      ...ROOT_NETWORK_NEUTRALS.map((spot) => ({
        x: spot.x * width,
        y: spot.y * height,
        reach: r(52),
      })),
      ...AGAR_POCKETS.map((pocket) => ({
        x: x(pocket.x),
        y: y(pocket.y),
        reach: r(pocket.r + 6),
      })),
    ].flatMap((hollow) => [
      hollow,
      { ...hollow, x: width - hollow.x, y: height - hollow.y },
    ]);
    const open = (rock: Rect) => {
      const centre = rectCenter(rock);
      return (
        clearOfSpawns(centre, r(46) + rock.width / 2, width, height) &&
        hollows.every(
          (hollow) => distance(centre, hollow) > hollow.reach + rock.width / 2
        )
      );
    };
    const random = seeded(23);
    const pillars = hexLattice(random, width, height, {
      spacing: r(56),
      jitter: 0.4,
      fill: 0.29,
      spread: 0.12,
      skip: 0.1,
    });
    const threads: Rect[] = [];
    for (let i = 0; i < 7; i++) {
      growThread(random, threads, width, height, {
        x: (width * (i + 0.5)) / 7 + (random() - 0.5) * (width / 7) * 0.4,
        y: -2,
        angle: Math.PI / 2 + (random() - 0.5) * 0.7,
        radius: r(7 + random() * 2),
        length: height * (0.24 + random() * 0.12),
      });
    }
    return pointSymmetric([...pillars, ...threads].filter(open), width, height);
  },
  createZones(width, height) {
    const { x, y, r } = board(width, height);
    return pointSymmetric(
      AGAR_POCKETS.map((pocket, i) =>
        puddle(
          'agar',
          x(pocket.x),
          y(pocket.y),
          r(pocket.r),
          r(pocket.r),
          30 + i
        )
      ).flat(),
      width,
      height
    );
  },
};

/** The agar pockets of Root Network's left half, on {@link BIG}. */
const AGAR_POCKETS = [
  { x: 320, y: 62, r: 22 },
  { x: 92, y: 66, r: 24 },
  { x: 238, y: 260, r: 20 },
] as const;

/**
 * The Abyss: the deep floor where the leviathan lives. Wide open water
 * round the start spots, for a colony four times yours; rock columns to
 * hide behind, hot vents between them and cold seeps by the edges.
 */
const abyss: GameMap = {
  id: 'abyss',
  name: 'Abyss',
  description: 'Open deep water, rock columns, hot vents and cold seeps.',
  size: 2,
  createWalls(width, height) {
    const { r } = board(width, height);
    const columns = hexLattice(seeded(24), width, height, {
      spacing: r(84),
      jitter: 0.5,
      fill: 0.17,
      spread: 0.1,
      skip: 0.3,
    }).filter((rock) =>
      clearOfSpawns(rectCenter(rock), r(66) + rock.width / 2, width, height)
    );
    return pointSymmetric(columns, width, height);
  },
  createZones(width, height) {
    const { x, y, r } = board(width, height);
    return pointSymmetric(
      [
        ...puddle('heat', x(320), y(96), r(34), r(28), 41),
        ...puddle('heat', x(250), y(300), r(26), r(22), 42),
        ...puddle('ice', x(30), y(60), r(28), r(44), 43),
        ...puddle('ice', x(130), y(340), r(40), r(18), 44),
      ],
      width,
      height
    );
  },
};

/** The big layouts, in the order the levels use them. */
export const EXPANSE_MAPS: readonly GameMap[] = [
  expanse,
  archipelago,
  bloodstream,
  rootNetwork,
  abyss,
];
