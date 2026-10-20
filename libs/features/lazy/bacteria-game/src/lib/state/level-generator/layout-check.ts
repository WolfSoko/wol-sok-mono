import { Rect, stampRect } from '../maps';
import { SPAWN_CLEARANCE, spawnSpots } from '../shapes';

/** How much of the arena the walls may take: neither bare nor a wall. */
const WALL_SHARE = { min: 0.03, max: 0.35 };

/** What the check found out about a layout. */
export interface LayoutReport {
  /** Share of the arena's cells under a wall. */
  wallShare: number;
  /** True when no wall reaches into a start spot. */
  spawnsFree: boolean;
  /**
   * The shortest way between the start spots through corridors at least
   * three cells wide, divided by the straight line - 1 is open ground, 1.8 a
   * maze. Null when there is no such way, or the layout failed before.
   */
  detour: number | null;
}

/** A layout fit to be played - see {@link checkLayout}. */
export type PlayableReport = LayoutReport & { detour: number };

export function isPlayable(report: LayoutReport): report is PlayableReport {
  return report.detour !== null;
}

/**
 * Lays the walls out on a grid of the arena and measures it: how much of it
 * they take, whether the start spots are free, and how far the way from one
 * start spot to the other is through corridors at least three cells wide.
 * The way is only looked for when the rest passes - it is the costly part.
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
  for (let index = 0; index < grid.length; index++) {
    wallCells += grid[index];
  }
  const wallShare = wallCells / grid.length;
  const spawns = spawnSpots(width, height);
  const spawnsFree = spawns.every(
    (spawn) => !wallWithin(grid, width, height, spawn, SPAWN_CLEARANCE - 1)
  );
  if (!spawnsFree || wallShare < WALL_SHARE.min || wallShare > WALL_SHARE.max) {
    return { wallShare, spawnsFree, detour: null };
  }
  const [from, to] = spawns.map(
    ({ x, y }) => Math.floor(y) * width + Math.floor(x)
  );
  const steps = walkingDistance(roomy(grid, width, height), width, from, to);
  return {
    wallShare,
    spawnsFree,
    detour:
      steps === null ? null : steps / Math.abs((to % width) - (from % width)),
  };
}

/**
 * The cells with no wall on them or next to them - the middle of a corridor
 * at least three cells wide. The arena's edge counts as a wall: a crack
 * between a wall and the edge is no corridor either.
 */
function roomy(grid: Uint8Array, width: number, height: number): Uint8Array {
  const open = new Uint8Array(grid.length);
  for (let y = 1; y < height - 1; y++) {
    open.fill(1, y * width + 1, y * width + width - 1);
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (grid[y * width + x] === 0) {
        continue;
      }
      const yMax = Math.min(height - 1, y + 1);
      const xMax = Math.min(width - 1, x + 1);
      for (let ny = Math.max(0, y - 1); ny <= yMax; ny++) {
        for (let nx = Math.max(0, x - 1); nx <= xMax; nx++) {
          open[ny * width + nx] = 0;
        }
      }
    }
  }
  return open;
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
  for (let head = 0; head < tail; head++) {
    const index = queue[head];
    if (index === to) {
      return steps[index];
    }
    const step = steps[index] + 1;
    const x = index % width;
    const left = x > 0 ? index - 1 : -1;
    const right = x < width - 1 ? index + 1 : -1;
    const up = index - width;
    const down = index + width < open.length ? index + width : -1;
    for (const next of [left, right, up, down]) {
      if (next >= 0 && open[next] === 1 && steps[next] < 0) {
        steps[next] = step;
        queue[tail++] = next;
      }
    }
  }
  return null;
}

/** True when a wall cell lies within `radius` of the point. */
function wallWithin(
  grid: Uint8Array,
  width: number,
  height: number,
  { x, y }: { x: number; y: number },
  radius: number
): boolean {
  const yMax = Math.min(height - 1, y + radius);
  const xMax = Math.min(width - 1, x + radius);
  for (let cy = Math.max(0, Math.floor(y - radius)); cy <= yMax; cy++) {
    for (let cx = Math.max(0, Math.floor(x - radius)); cx <= xMax; cx++) {
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
