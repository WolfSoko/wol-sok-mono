import { Point } from './geometry';
import { Rect } from './maps';
import { flood, navGrid, travel, waypoint, withWalls } from './bot-navigation';
import { Zone } from './zones';

// The base arena: a grid cell is 4 arena cells across.
const WIDTH = 320;
const HEIGHT = 180;

/** A wall across the middle, from the top down to `gapAt`. */
function barrier(gapAt: number): Rect {
  return { x: 156, y: 0, width: 8, height: gapAt };
}

describe('bot navigation', () => {
  const from: Point = { x: 80, y: 40 };
  const to: Point = { x: 240, y: 40 };

  it('goes straight where nothing is in the way', () => {
    const field = flood(navGrid(WIDTH, HEIGHT, [], [], 1), from);

    expect(waypoint(field, to)).toEqual(to);
    expect(travel(field, to)).toBeCloseTo(160, -1);
  });

  it('heads round a wall instead of into it', () => {
    const field = flood(navGrid(WIDTH, HEIGHT, [barrier(140)], [], 1), from);

    const next = waypoint(field, to);

    // Down towards the gap under the wall, not straight across.
    expect(next.y).toBeGreaterThan(100);
    expect(next.x).toBeLessThanOrEqual(164);
    // The way round is longer than the straight line.
    expect(travel(field, to)).toBeGreaterThan(250);
  });

  it('cannot reach a spot walled in all round', () => {
    const box: Rect[] = [
      { x: 200, y: 20, width: 80, height: 6 },
      { x: 200, y: 60, width: 80, height: 6 },
      { x: 200, y: 20, width: 6, height: 46 },
      { x: 274, y: 20, width: 6, height: 46 },
    ];
    const field = flood(navGrid(WIDTH, HEIGHT, box, [], 1), from);

    expect(travel(field, to)).toBe(Number.POSITIVE_INFINITY);
    // As close as the colony gets - outside the box, not into its wall.
    const next = waypoint(field, to);
    const inBox = next.x > 200 && next.x < 280 && next.y > 20 && next.y < 66;
    expect(inBox).toBe(false);
    expect(Math.hypot(next.x - to.x, next.y - to.y)).toBeLessThan(50);
  });

  it('goes round antibiotic when the way round is short', () => {
    const poison: Zone = {
      kind: 'antibiotic',
      x: 140,
      y: 20,
      width: 40,
      height: 40,
    };
    const field = flood(navGrid(WIDTH, HEIGHT, [], [poison], 1), from);

    const next = waypoint(field, to);

    expect(next).not.toEqual(to);
    expect(next.y < 20 || next.y > 60).toBe(true);
  });

  it('treats a gate that is shut as a wall', () => {
    const grid = navGrid(WIDTH, HEIGHT, [barrier(140)], [], 1);
    const gate: Rect = { x: 156, y: 140, width: 8, height: 40 };

    const open = travel(flood(grid, from), to);
    const shut = travel(flood(withWalls(grid, [gate]), from), to);

    expect(open).toBeLessThan(Number.POSITIVE_INFINITY);
    expect(shut).toBe(Number.POSITIVE_INFINITY);
  });

  it('keeps a thin channel open that walls only half fill', () => {
    // Two walls 6 cells apart leave a channel narrower than two grid cells.
    const walls: Rect[] = [
      { x: 0, y: 70, width: 157, height: 20 },
      { x: 163, y: 70, width: 157, height: 20 },
    ];
    const field = flood(navGrid(WIDTH, HEIGHT, walls, [], 1), from);

    expect(travel(field, { x: 80, y: 140 })).toBeLessThan(
      Number.POSITIVE_INFINITY
    );
  });

  it('starts from the nearest open spot when the colony sits on a wall', () => {
    const wall: Rect = { x: 60, y: 20, width: 40, height: 40 };
    const field = flood(navGrid(WIDTH, HEIGHT, [wall], [], 1), from);

    expect(travel(field, to)).toBeLessThan(Number.POSITIVE_INFINITY);
  });
});
