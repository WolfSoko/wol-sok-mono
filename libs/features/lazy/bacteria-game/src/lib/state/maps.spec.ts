import { GAME_MAPS, getMap } from './game-maps';
import {
  coversCell,
  gateState,
  overlapsArena,
  pointSymmetric,
  Rect,
  slideOffset,
  stampRect,
} from './maps';
import { stampZones } from './zones';

// The production canvas size. A smaller arena pushes most layouts outside the
// grid, which would make every test pass without a single wall cell existing.
const WIDTH = 320;
const HEIGHT = 180;

/** True when the cell is inside one of the walls. */
function isSolid(walls: Rect[], x: number, y: number): boolean {
  return walls.some((rect) => coversCell(rect, x, y));
}

/**
 * True when the wall lies inside an arena of that size. A round wall may hang
 * over the edge - it is clipped when it is stamped - but must reach into it.
 */
function insideArena(wall: Rect, width: number, height: number): boolean {
  if (wall.round) {
    return overlapsArena(wall, width, height);
  }
  return (
    wall.x >= 0 &&
    wall.y >= 0 &&
    wall.x + wall.width <= width &&
    wall.y + wall.height <= height
  );
}

/** The arena grid with every cell a wall covers set to 1. */
function solidGrid(walls: Rect[]): Uint8Array {
  const grid = new Uint8Array(WIDTH * HEIGHT);
  for (const wall of walls) {
    stampRect(grid, WIDTH, HEIGHT, wall, 1);
  }
  return grid;
}

/**
 * The cells that differ from their 180° rotation - the rotation of cell `i`
 * is cell `length - 1 - i`.
 */
function asymmetricCells(walls: Rect[]): number[] {
  const grid = solidGrid(walls);
  const cells: number[] = [];
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] !== grid[grid.length - 1 - i]) {
      cells.push(i);
    }
  }
  return cells;
}

/** True when a colony can walk from one start spot to the other. */
function spawnsConnected(walls: Rect[]): boolean {
  const grid = solidGrid(walls);
  const start = (HEIGHT / 2) * WIDTH + WIDTH / 4;
  const goal = (HEIGHT / 2) * WIDTH + (WIDTH / 4) * 3;
  const queue = [start];
  grid[start] = 2;
  while (queue.length > 0) {
    const cell = queue.pop() as number;
    if (cell === goal) {
      return true;
    }
    const x = cell % WIDTH;
    const neighbours = [
      x > 0 ? cell - 1 : -1,
      x < WIDTH - 1 ? cell + 1 : -1,
      cell - WIDTH,
      cell + WIDTH,
    ];
    for (const next of neighbours) {
      if (next >= 0 && next < grid.length && grid[next] === 0) {
        grid[next] = 2;
        queue.push(next);
      }
    }
  }
  return false;
}

describe('GAME_MAPS', () => {
  it.each(GAME_MAPS.map((map) => [map.name, map] as const))(
    '%s is point symmetric so neither player gets the better half',
    (_name, map) => {
      expect(asymmetricCells(map.createWalls(WIDTH, HEIGHT))).toEqual([]);
    }
  );

  it.each(GAME_MAPS.map((map) => [map.name, map] as const))(
    '%s keeps every wall inside the arena',
    (_name, map) => {
      for (const wall of map.createWalls(WIDTH, HEIGHT)) {
        expect(insideArena(wall, WIDTH, HEIGHT)).toBe(true);
        expect(wall.width).toBeGreaterThan(0);
        expect(wall.height).toBeGreaterThan(0);
      }
    }
  );

  it.each(GAME_MAPS.map((map) => [map.name, map] as const))(
    '%s leaves room for both starting blobs',
    (_name, map) => {
      const walls = map.createWalls(WIDTH, HEIGHT);
      // The largest radius any level spawns with - a blob inside a wall would
      // start the match with bacteria stuck in solid rock.
      const radius = 16;

      for (const centreX of [WIDTH / 4, (WIDTH / 4) * 3]) {
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            if (dx * dx + dy * dy > radius * radius) {
              continue;
            }
            expect(isSolid(walls, centreX + dx, HEIGHT / 2 + dy)).toBe(false);
          }
        }
      }
    }
  );

  it.each(GAME_MAPS.map((map) => [map.name, map] as const))(
    '%s lets the colonies reach each other',
    (_name, map) => {
      const walls = map.createWalls(WIDTH, HEIGHT);
      // A gate may seal the way for a while, but never for good.
      const openAtSomePoint = [0, 0.4, 1.3, 2.5, 5].some((time) =>
        spawnsConnected([
          ...walls,
          ...(map.createDynamicWalls?.(WIDTH, HEIGHT, time) ?? []).filter(
            (wall) => wall.solid
          ),
        ])
      );

      expect(spawnsConnected(walls)).toBe(true);
      expect(openAtSomePoint).toBe(true);
    }
  );

  const zoned = GAME_MAPS.filter((map) => map.createZones != null).map(
    (map) => [map.name, map] as const
  );

  it.each(zoned)('%s lays its zones out point symmetric', (_name, map) => {
    const zones = map.createZones?.(WIDTH, HEIGHT) ?? [];
    const grid = new Uint8Array(WIDTH * HEIGHT);
    stampZones(grid, WIDTH, HEIGHT, zones);

    expect(zones.length).toBeGreaterThan(0);
    expect(
      grid.filter((code, i) => code !== grid[grid.length - 1 - i])
    ).toEqual(new Uint8Array(0));
  });

  it.each(zoned)(
    '%s keeps the antibiotic off the start spots',
    (_name, map) => {
      const poison = (map.createZones?.(WIDTH, HEIGHT) ?? []).filter(
        (zone) => zone.kind === 'antibiotic'
      );

      for (const x of [WIDTH / 4, (WIDTH / 4) * 3]) {
        expect(isSolid(poison, x, HEIGHT / 2)).toBe(false);
      }
    }
  );

  it('uses unique ids', () => {
    const ids = GAME_MAPS.map((map) => map.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps the open field empty', () => {
    expect(getMap('open-field').createWalls(WIDTH, HEIGHT)).toEqual([]);
  });

  it('survives an arena that is smaller than the layout', () => {
    for (const map of GAME_MAPS) {
      const walls = map.createWalls(40, 20);

      for (const wall of walls) {
        expect(insideArena(wall, 40, 20)).toBe(true);
      }
    }
  });
});

describe('getMap', () => {
  it('finds a map by its id', () => {
    expect(getMap('pillar-field').id).toBe('pillar-field');
  });

  it('falls back to the corridors layout for an unknown id', () => {
    expect(getMap('does-not-exist').id).toBe('corridors');
  });
});

describe('round walls', () => {
  const disc: Rect = { x: 10, y: 10, width: 8, height: 8, round: true };

  it('cover the ellipse inside their rect, not its corners', () => {
    expect(coversCell(disc, 14, 14)).toBe(true);
    expect(coversCell(disc, 10, 14)).toBe(true);
    expect(coversCell(disc, 10, 10)).toBe(false);
    expect(coversCell(disc, 17, 17)).toBe(false);
  });

  it('are stamped as the cells they cover', () => {
    const grid = new Uint8Array(30 * 30);
    stampRect(grid, 30, 30, disc, 1);

    for (let y = 0; y < 30; y++) {
      for (let x = 0; x < 30; x++) {
        expect(grid[y * 30 + x] === 1).toBe(coversCell(disc, x, y));
      }
    }
  });

  it('are kept whole by pointSymmetric when they hang over the edge', () => {
    const walls = pointSymmetric(
      [{ x: -4, y: 0, width: 8, height: 8, round: true }],
      100,
      50
    );

    expect(walls).toEqual([
      { x: -4, y: 0, width: 8, height: 8, round: true },
      { x: 96, y: 42, width: 8, height: 8, round: true },
    ]);
  });
});

describe('pointSymmetric', () => {
  it('adds the 180° rotation of every rect', () => {
    const walls = pointSymmetric(
      [{ x: 0, y: 0, width: 4, height: 2 }],
      100,
      50
    );

    expect(walls).toEqual([
      { x: 0, y: 0, width: 4, height: 2 },
      { x: 96, y: 48, width: 4, height: 2 },
    ]);
  });

  it('keeps a rect that is its own mirror image exactly once', () => {
    const walls = pointSymmetric(
      [{ x: 48, y: 24, width: 4, height: 2 }],
      100,
      50
    );

    expect(walls).toHaveLength(1);
  });

  it('drops what lies completely outside the arena', () => {
    const walls = pointSymmetric(
      [{ x: 200, y: 0, width: 4, height: 2 }],
      100,
      50
    );

    expect(walls).toEqual([]);
  });
});

describe('dynamic walls', () => {
  const dynamicMaps = GAME_MAPS.filter(
    (map) => map.createDynamicWalls != null
  ).map((map) => [map.name, map] as const);
  // Every quarter second across the longest cycle any map uses.
  const times = Array.from({ length: 81 }, (_, step) => step * 0.25);

  it('exist on some maps', () => {
    expect(dynamicMaps.length).toBeGreaterThan(0);
  });

  it.each(dynamicMaps)(
    '%s stays point symmetric at every moment',
    (_name, map) => {
      for (const time of times) {
        const solid = map.createDynamicWalls!(WIDTH, HEIGHT, time).filter(
          (wall) => wall.solid
        );
        expect(asymmetricCells(solid)).toEqual([]);
      }
    }
  );

  it.each(dynamicMaps)(
    '%s keeps its moving walls inside the arena and off the spawns',
    (_name, map) => {
      const radius = 16;
      const blocked: string[] = [];
      for (const time of times) {
        const walls = map.createDynamicWalls!(WIDTH, HEIGHT, time);
        for (const wall of walls) {
          expect(insideArena(wall, WIDTH, HEIGHT)).toBe(true);
        }
        for (const centreX of [WIDTH / 4, (WIDTH / 4) * 3]) {
          for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
              if (
                dx * dx + dy * dy <= radius * radius &&
                isSolid(walls, centreX + dx, HEIGHT / 2 + dy)
              ) {
                blocked.push(`${time}s: ${centreX + dx}:${HEIGHT / 2 + dy}`);
              }
            }
          }
        }
      }
      expect(blocked).toEqual([]);
    }
  );
});

describe('gateState', () => {
  const timing = { periodSec: 10, closedSec: 3, warningSec: 2 };

  it('is open and quiet early in the cycle', () => {
    expect(gateState(timing, 1)).toEqual({ solid: false, warning: 0 });
  });

  it('warns more and more before it closes', () => {
    const early = gateState(timing, 5.5);
    const late = gateState(timing, 6.5);

    expect(early.solid).toBe(false);
    expect(early.warning).toBeGreaterThan(0);
    expect(late.warning).toBeGreaterThan(early.warning);
  });

  it('is closed at the end of the cycle and open again after it', () => {
    expect(gateState(timing, 8).solid).toBe(true);
    expect(gateState(timing, 10.5).solid).toBe(false);
  });

  it('shifts the cycle by its offset', () => {
    expect(gateState({ ...timing, offsetSec: 7 }, 1).solid).toBe(true);
  });
});

describe('slideOffset', () => {
  it('swings between both amplitudes in whole cells', () => {
    expect(slideOffset(10, 4, 0)).toBe(0);
    expect(slideOffset(10, 4, 1)).toBe(10);
    expect(slideOffset(10, 4, 3)).toBe(-10);
    expect(Number.isInteger(slideOffset(10, 4, 0.3))).toBe(true);
  });
});
