import { Rect, stampRect } from '../maps';
import { SPAWN_CLEARANCE, spawnSpots } from './shapes';

/**
 * The narrowest way between the two start spots a layout may have, in cells:
 * anything narrower is a crack a colony can hardly get through.
 */
const MIN_CORRIDOR = 3;

/** How much of the arena the walls may take: neither bare nor a wall. */
export const WALL_SHARE = { min: 0.03, max: 0.35 };

/** What the check found out about a layout. */
export interface LayoutReport {
  /** Share of the arena's cells under a wall. */
  wallShare: number;
  /**
   * The shortest way between the start spots through corridors wide enough,
   * divided by the straight line - 1 is open ground, 1.8 a maze. Null when
   * there is no such way.
   */
  detour: number | null;
  /** True when no wall reaches into a start spot. */
  spawnsFree: boolean;
}

/** True when a layout is fit to be played - see {@link checkLayout}. */
export function isPlayable(report: LayoutReport): boolean {
  return (
    report.spawnsFree &&
    report.detour !== null &&
    report.wallShare >= WALL_SHARE.min &&
    report.wallShare <= WALL_SHARE.max
  );
}

/**
 * Lays the walls out on a grid of the arena and measures it: how much of it
 * they take, whether the start spots are free, and how far the way from one
 * start spot to the other is through corridors at least
 * {@link MIN_CORRIDOR} cells wide.
 */
export function checkLayout(
  walls: readonly Rect[],
  width: number,
  height: number
): LayoutReport {
  const grid = new Uint8Array(width * height);
  for (const wall of walls) {
    stampRect(grid, width, height, wall, 1);
  }
  let wallCells = 0;
  for (const cell of grid) {
    wallCells += cell;
  }
  const spawns = spawnSpots(width, height);
  const [from, to] = spawns.map(
    ({ x, y }) => Math.floor(y) * width + Math.floor(x)
  );
  const clearance = wallDistance(grid, width, height);
  const open = new Uint8Array(grid.length);
  clearance.forEach((cells, index) => {
    open[index] = cells * 2 >= MIN_CORRIDOR ? 1 : 0;
  });
  const steps = walkingDistance(open, width, from, to);
  return {
    wallShare: wallCells / grid.length,
    detour:
      steps === null ? null : steps / Math.abs((to % width) - (from % width)),
    spawnsFree: spawns.every(
      (spawn) => !wallWithin(grid, width, height, spawn, SPAWN_CLEARANCE - 1)
    ),
  };
}

/** True when a wall cell lies within `radius` of the point. */
function wallWithin(
  grid: Uint8Array,
  width: number,
  height: number,
  { x, y }: { x: number; y: number },
  radius: number
): boolean {
  for (
    let cy = Math.max(0, Math.floor(y - radius));
    cy <= Math.min(height - 1, y + radius);
    cy++
  ) {
    for (
      let cx = Math.max(0, Math.floor(x - radius));
      cx <= Math.min(width - 1, x + radius);
      cx++
    ) {
      if (
        grid[cy * width + cx] === 1 &&
        Math.hypot(cx + 0.5 - x, cy + 0.5 - y) <= radius
      ) {
        return true;
      }
    }
  }
  return false;
}

/**
 * How many cells each cell is from the nearest wall, counted in steps that
 * may go diagonally. The arena's edge is no wall: the colonies do not need
 * room against it.
 */
function wallDistance(
  grid: Uint8Array,
  width: number,
  height: number
): Uint16Array {
  const far = 0xffff;
  const distance = new Uint16Array(grid.length).fill(far);
  const queue = new Int32Array(grid.length);
  let tail = 0;
  grid.forEach((cell, index) => {
    if (cell === 1) {
      distance[index] = 0;
      queue[tail++] = index;
    }
  });
  for (let head = 0; head < tail; head++) {
    const index = queue[head];
    const x = index % width;
    const y = (index - x) / width;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
          continue;
        }
        const next = ny * width + nx;
        if (distance[next] === far) {
          distance[next] = distance[index] + 1;
          queue[tail++] = next;
        }
      }
    }
  }
  return distance;
}

/** Steps from one cell to the other over the `open` cells, or null. */
function walkingDistance(
  open: Uint8Array,
  width: number,
  from: number,
  to: number
): number | null {
  const steps = new Int32Array(open.length).fill(-1);
  const queue = new Int32Array(open.length);
  let tail = 0;
  steps[from] = 0;
  queue[tail++] = from;
  const visit = (next: number, step: number) => {
    if (open[next] === 1 && steps[next] < 0) {
      steps[next] = step;
      queue[tail++] = next;
    }
  };
  for (let head = 0; head < tail; head++) {
    const index = queue[head];
    if (index === to) {
      return steps[index];
    }
    const step = steps[index] + 1;
    const x = index % width;
    if (x > 0) visit(index - 1, step);
    if (x < width - 1) visit(index + 1, step);
    if (index >= width) visit(index - width, step);
    if (index + width < open.length) visit(index + width, step);
  }
  return null;
}
