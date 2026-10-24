import { CHAPTERS } from './chapters';
import { ROOT_NETWORK_NEUTRALS, valveOpening } from './expanse-maps';
import { getMap } from './game-maps';
import { getLevel, levelSize, ONLINE_LOCKS } from './levels';
import { GameMap, Rect, stampRect } from './maps';
import { spawnSpots } from './shapes';
import { ZONE_CODE, stampZones } from './zones';

/** A big map on the Normal grid: two base arenas a side. */
const WIDTH = 640;
const HEIGHT = 360;

const BIG_LEVELS = ['archipelago', 'bloodstream', 'root-network', 'leviathan'];

/** The cells walls cover, 1 for a wall. */
function wallGrid(walls: readonly Rect[]): Uint8Array {
  const grid = new Uint8Array(WIDTH * HEIGHT);
  for (const wall of walls) {
    stampRect(grid, WIDTH, HEIGHT, wall, 1);
  }
  return grid;
}

/** The zone code of every cell. */
function zoneGrid(map: GameMap): Uint8Array {
  const grid = new Uint8Array(WIDTH * HEIGHT);
  stampZones(grid, WIDTH, HEIGHT, map.createZones?.(WIDTH, HEIGHT) ?? []);
  return grid;
}

/** True when a colony walks from `from` to `to` over open cells alone. */
function reaches(
  open: (cell: number) => boolean,
  from: { x: number; y: number },
  to: { x: number; y: number }
): boolean {
  const start = Math.round(from.y) * WIDTH + Math.round(from.x);
  const goal = Math.round(to.y) * WIDTH + Math.round(to.x);
  const seen = new Uint8Array(WIDTH * HEIGHT);
  const queue = [start];
  seen[start] = 1;
  while (queue.length > 0) {
    const cell = queue.pop() as number;
    if (cell === goal) {
      return true;
    }
    const x = cell % WIDTH;
    for (const next of [
      x > 0 ? cell - 1 : -1,
      x < WIDTH - 1 ? cell + 1 : -1,
      cell - WIDTH,
      cell + WIDTH,
    ]) {
      if (next >= 0 && next < seen.length && !seen[next] && open(next)) {
        seen[next] = 1;
        queue.push(next);
      }
    }
  }
  return false;
}

describe('the big levels', () => {
  it.each(BIG_LEVELS)('%s is a big map, kept from online play', (id) => {
    expect(levelSize(getLevel(id))).toBe(2);
    expect(ONLINE_LOCKS[id]).toBeDefined();
  });

  it('close the ladder in the Expanse chapter', () => {
    const expanse = CHAPTERS.find((chapter) => chapter.id === 'expanse');

    expect(expanse?.levelIds).toEqual(['expanse', ...BIG_LEVELS]);
  });
});

describe('archipelago', () => {
  const map = getMap('archipelago');
  const walls = wallGrid(map.createWalls(WIDTH, HEIGHT));
  const zones = zoneGrid(map);
  const hill = { x: WIDTH / 2, y: HEIGHT / 2 };

  it('leads from both start islands to the hold zone over bridges, never through antibiotic', () => {
    const dry = (cell: number) =>
      walls[cell] === 0 && zones[cell] !== ZONE_CODE.antibiotic;

    expect(zones[hill.y * WIDTH + hill.x]).toBe(ZONE_CODE.hill);
    for (const spawn of spawnSpots(WIDTH, HEIGHT)) {
      expect(reaches(dry, spawn, hill)).toBe(true);
    }
  });

  it('has no dry way straight across the middle - only round over the islands', () => {
    // Without the bridges to the north and the south islands, the start
    // islands are cut off from each other by the sea.
    const dryAcross = (cell: number) => {
      const y = Math.floor(cell / WIDTH);
      return (
        walls[cell] === 0 &&
        zones[cell] !== ZONE_CODE.antibiotic &&
        y > HEIGHT * 0.3 &&
        y < HEIGHT * 0.7
      );
    };
    const [left, right] = spawnSpots(WIDTH, HEIGHT);

    expect(reaches(dryAcross, left, right)).toBe(false);
  });
});

describe('bloodstream', () => {
  const map = getMap('bloodstream');
  const walls = wallGrid(map.createWalls(WIDTH, HEIGHT));
  const [left, right] = spawnSpots(WIDTH, HEIGHT);

  it('keeps the long way open at every moment of the valves', () => {
    for (let time = 0; time < 10; time += 0.5) {
      const moving = wallGrid(
        (map.createDynamicWalls?.(WIDTH, HEIGHT, time) ?? []).filter(
          (wall) => wall.solid
        )
      );
      const open = (cell: number) => walls[cell] === 0 && moving[cell] === 0;

      expect(reaches(open, left, right)).toBe(true);
    }
  });

  it('shuts the valve for a while, then opens it', () => {
    expect(valveOpening(0)).toBe(0);
    expect(valveOpening(4)).toBeCloseTo(0.5);
    expect(valveOpening(6)).toBe(1);
    expect(valveOpening(9.5)).toBeCloseTo(0.5);
    expect(valveOpening(16)).toBe(valveOpening(6));
  });

  it('pinches the valves by turns, never quite shut', () => {
    const movingAt = (time: number) =>
      map.createDynamicWalls?.(WIDTH, HEIGHT, time) ?? [];
    // The first flap is the far valve's, the third the one by the heart's.
    const [farAt1, , nearAt1] = movingAt(1);
    const [farAt6, , nearAt6] = movingAt(6);

    expect(farAt1.width).toBeGreaterThan(farAt6.width);
    expect(nearAt1.width).toBeLessThan(nearAt6.width);
    // Shut, a valve still leaves a slit between its two flaps.
    const [leftFlap, rightFlap] = movingAt(1);
    expect(rightFlap.x - (leftFlap.x + leftFlap.width)).toBeGreaterThanOrEqual(
      10
    );
  });

  it('keeps the ways out by the heart open at every moment', () => {
    // Out of the middle vessel through a valve by the heart - never as far
    // out as the far valves.
    for (const time of [0, 1, 4, 6, 9.5]) {
      const moving = wallGrid(
        (map.createDynamicWalls?.(WIDTH, HEIGHT, time) ?? []).filter(
          (wall) => wall.solid
        )
      );
      const nearHeart = (cell: number) => {
        const x = cell % WIDTH;
        return (
          walls[cell] === 0 &&
          moving[cell] === 0 &&
          x > WIDTH * 0.2 &&
          x < WIDTH * 0.8
        );
      };

      expect(reaches(nearHeart, left, { x: WIDTH / 2, y: 40 })).toBe(true);
      expect(reaches(nearHeart, left, { x: WIDTH / 2, y: HEIGHT - 40 })).toBe(
        true
      );
    }
  });
});

describe('root network', () => {
  const map = getMap('root-network');
  const walls = wallGrid(map.createWalls(WIDTH, HEIGHT));
  const zones = zoneGrid(map);

  it('keeps a hollow on agar free round each grey colony', () => {
    const level = getLevel('root-network');
    expect(level.neutrals?.map(({ x, y }) => ({ x, y }))).toEqual(
      ROOT_NETWORK_NEUTRALS.map(({ x, y }) => ({ x, y }))
    );
    for (const spot of ROOT_NETWORK_NEUTRALS) {
      const cx = Math.round(spot.x * WIDTH);
      const cy = Math.round(spot.y * HEIGHT);
      expect(zones[cy * WIDTH + cx]).toBe(ZONE_CODE.agar);
      const walled: number[] = [];
      for (let dy = -30; dy <= 30; dy++) {
        for (let dx = -30; dx <= 30; dx++) {
          const cell = (cy + dy) * WIDTH + cx + dx;
          if (dx * dx + dy * dy <= 30 * 30 && walls[cell] !== 0) {
            walled.push(cell);
          }
        }
      }
      expect(walled).toEqual([]);
    }
  });

  it('lets both colonies reach both grey colonies', () => {
    const open = (cell: number) => walls[cell] === 0;
    for (const spawn of spawnSpots(WIDTH, HEIGHT)) {
      for (const spot of ROOT_NETWORK_NEUTRALS) {
        expect(
          reaches(open, spawn, { x: spot.x * WIDTH, y: spot.y * HEIGHT })
        ).toBe(true);
      }
    }
  });
});

describe('leviathan', () => {
  it('sends a boss four times your size', () => {
    expect(getLevel('leviathan').boss?.startScale).toBe(4);
  });
});
