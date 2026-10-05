import { GAME_MAPS, getMap, pointSymmetric, Rect } from './maps';

// The production canvas size. A smaller arena pushes most layouts outside the
// grid, which would make every test pass without a single wall cell existing.
const WIDTH = 320;
const HEIGHT = 140;

/** True when the cell is inside one of the rects. */
function isSolid(walls: Rect[], x: number, y: number): boolean {
  return walls.some(
    (rect) =>
      x >= rect.x &&
      x < rect.x + rect.width &&
      y >= rect.y &&
      y < rect.y + rect.height
  );
}

describe('GAME_MAPS', () => {
  it.each(GAME_MAPS.map((map) => [map.name, map] as const))(
    '%s is point symmetric so neither player gets the better half',
    (_name, map) => {
      const walls = map.createWalls(WIDTH, HEIGHT);

      for (let y = 0; y < HEIGHT; y++) {
        for (let x = 0; x < WIDTH; x++) {
          expect(isSolid(walls, x, y)).toBe(
            isSolid(walls, WIDTH - 1 - x, HEIGHT - 1 - y)
          );
        }
      }
    }
  );

  it.each(GAME_MAPS.map((map) => [map.name, map] as const))(
    '%s keeps every wall inside the arena',
    (_name, map) => {
      for (const wall of map.createWalls(WIDTH, HEIGHT)) {
        expect(wall.x).toBeGreaterThanOrEqual(0);
        expect(wall.y).toBeGreaterThanOrEqual(0);
        expect(wall.x + wall.width).toBeLessThanOrEqual(WIDTH);
        expect(wall.y + wall.height).toBeLessThanOrEqual(HEIGHT);
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
        expect(wall.x + wall.width).toBeLessThanOrEqual(40);
        expect(wall.y + wall.height).toBeLessThanOrEqual(20);
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
