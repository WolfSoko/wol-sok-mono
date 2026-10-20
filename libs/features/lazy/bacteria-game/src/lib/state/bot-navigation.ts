/**
 * How the computer finds its way: a coarse grid over the arena that knows
 * the walls and what each zone costs to cross, a flood of travel distances
 * out from the bot's colony, and the waypoint it sends its crosshair to so
 * the colony goes round a wall instead of piling up in front of it.
 *
 * Pure and deterministic, so a recorded match plays out the same again.
 */

import { BASE_ARENA } from './arena-size';
import { clamp, Point } from './geometry';
import { coversCell, Rect } from './maps';
import { Zone, ZoneKind } from './zones';

/** Cells of the base arena per side of a grid cell. */
export const NAV_CELL = 4;

/** The cost of crossing a cell of each kind of zone, 1 for plain ground. */
const ZONE_COST: Readonly<Record<ZoneKind, number>> = {
  // Kills a colony that lingers - only worth crossing to save a long way.
  antibiotic: 8,
  // Half the speed.
  ice: 2,
  agar: 0.8,
  heat: 1,
  hill: 1,
};

/** A cell no colony gets through. */
const BLOCKED = Number.POSITIVE_INFINITY;

/**
 * How far along the way the crosshair goes at least, in grid cells - a
 * colony follows its crosshair round a corner only once it is round it.
 */
const LEAD_CELLS = 8;

/**
 * A way round walls at most this much longer than the straight line is no
 * detour: the colony flows along the wall on its own, and gathering it at a
 * corner only holds it up. A longer way - out of a dead end, round to a
 * door - is steered, and so is any way round costly ground like antibiotic.
 */
const DETOUR_LIMIT = 1.25;

/** A cell the waypoint's straight line avoids - a wall, or worse ground. */
const DETOUR_COST = 1.5;

const STEPS: readonly [number, number, number][] = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
];

/** The arena as the bot plans on it: what each grid cell costs to cross. */
export interface NavGrid {
  columns: number;
  rows: number;
  /** Arena cells per side of a grid cell. */
  cell: number;
  /** Cost per grid cell, {@link BLOCKED} for a wall. */
  cost: Float32Array;
}

/**
 * The grid of an arena of that size: a cell is blocked where a wall covers
 * its centre, and costs what the zone under its centre costs.
 */
export function navGrid(
  width: number,
  height: number,
  walls: readonly Rect[],
  zones: readonly Zone[]
): NavGrid {
  const cell = Math.max(1, (NAV_CELL * width) / BASE_ARENA.width);
  const columns = Math.ceil(width / cell);
  const rows = Math.ceil(height / cell);
  const cost = new Float32Array(columns * rows).fill(1);
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const x = Math.min(width - 1, Math.floor((column + 0.5) * cell));
      const y = Math.min(height - 1, Math.floor((row + 0.5) * cell));
      const index = row * columns + column;
      if (walls.some((wall) => coversCell(wall, x, y))) {
        cost[index] = BLOCKED;
        continue;
      }
      // The last zone over a spot wins, as when the zones are stamped.
      const zone = zones.findLast((candidate) => coversCell(candidate, x, y));
      if (zone !== undefined) {
        cost[index] = ZONE_COST[zone.kind];
      }
    }
  }
  return { columns, rows, cell, cost };
}

/** The grid with these walls blocked as well - gates and sliding walls. */
export function withWalls(grid: NavGrid, walls: readonly Rect[]): NavGrid {
  if (walls.length === 0) {
    return grid;
  }
  const cost = grid.cost.slice();
  for (const wall of walls) {
    const fromColumn = Math.max(0, Math.floor(wall.x / grid.cell));
    const toColumn = Math.min(
      grid.columns - 1,
      Math.floor((wall.x + wall.width) / grid.cell)
    );
    const fromRow = Math.max(0, Math.floor(wall.y / grid.cell));
    const toRow = Math.min(
      grid.rows - 1,
      Math.floor((wall.y + wall.height) / grid.cell)
    );
    for (let row = fromRow; row <= toRow; row++) {
      for (let column = fromColumn; column <= toColumn; column++) {
        const x = Math.floor((column + 0.5) * grid.cell);
        const y = Math.floor((row + 0.5) * grid.cell);
        if (coversCell(wall, x, y)) {
          cost[row * grid.columns + column] = BLOCKED;
        }
      }
    }
  }
  return { ...grid, cost };
}

/** The travel distances out from one spot - see {@link flood}. */
export interface NavField {
  grid: NavGrid;
  /** The grid cell the flood started from. */
  start: number;
  /** Travel cost from the start to each cell, in arena cells. */
  distance: Float64Array;
  /** The cell each cell is reached from on the cheapest way, -1 for none. */
  previous: Int32Array;
}

/**
 * The cheapest travel from a spot to every cell of the grid - Dijkstra over
 * eight neighbours, a diagonal not cutting the corner of a wall.
 */
export function flood(grid: NavGrid, from: Point): NavField {
  const cells = grid.columns * grid.rows;
  // Doubles, as the queue holds them: rounding to floats would make a fresh
  // entry look stale.
  const distance = new Float64Array(cells).fill(Number.POSITIVE_INFINITY);
  const previous = new Int32Array(cells).fill(-1);
  const start = nearestOpen(grid, cellOf(grid, from));
  const field: NavField = { grid, start, distance, previous };
  if (start < 0) {
    return field;
  }
  distance[start] = 0;
  const queue = new MinQueue();
  queue.push(start, 0);
  while (queue.size > 0) {
    const [index, travelled] = queue.pop();
    if (travelled > distance[index]) {
      continue;
    }
    const column = index % grid.columns;
    const row = Math.floor(index / grid.columns);
    for (const [dx, dy, length] of STEPS) {
      const toColumn = column + dx;
      const toRow = row + dy;
      if (!inGrid(grid, toColumn, toRow)) {
        continue;
      }
      const to = toRow * grid.columns + toColumn;
      if (grid.cost[to] === BLOCKED) {
        continue;
      }
      if (
        dx !== 0 &&
        dy !== 0 &&
        (grid.cost[row * grid.columns + toColumn] === BLOCKED ||
          grid.cost[toRow * grid.columns + column] === BLOCKED)
      ) {
        continue;
      }
      const reached = travelled + length * grid.cost[to] * grid.cell;
      if (reached < distance[to]) {
        distance[to] = reached;
        previous[to] = index;
        queue.push(to, reached);
      }
    }
  }
  return field;
}

/** How far it is to travel to a point, infinite where it cannot be reached. */
export function travel(field: NavField, to: Point): number {
  const index = nearestOpen(field.grid, cellOf(field.grid, to));
  return index < 0 ? Number.POSITIVE_INFINITY : field.distance[index];
}

/**
 * Where to send the crosshair to get to a point: the point itself when the
 * way is clear or no real detour, else a spot along the cheapest way - the furthest one in a
 * straight line from the colony, but at least {@link LEAD_CELLS} along it,
 * so the crosshair waits round the corner and the colony flows along the
 * wall towards it. The point itself where it cannot be reached at all.
 */
export function waypoint(field: NavField, to: Point): Point {
  const { grid } = field;
  const goal = nearestOpen(grid, cellOf(grid, to));
  if (goal < 0 || field.start < 0 || !isFinite(field.distance[goal])) {
    return to;
  }
  const path: number[] = [];
  for (let index = goal; index >= 0; index = field.previous[index]) {
    path.push(index);
  }
  path.reverse();
  const from = centreOf(grid, field.start);
  const line = lineOf(grid, from, to);
  const straight = Math.hypot(to.x - from.x, to.y - from.y);
  if (
    line === 'clear' ||
    (line === 'walled' && field.distance[goal] <= straight * DETOUR_LIMIT)
  ) {
    return to;
  }
  let reach = 0;
  while (
    reach + 1 < path.length &&
    clearLine(grid, from, centreOf(grid, path[reach + 1]))
  ) {
    reach++;
  }
  const lead = Math.min(path.length - 1, LEAD_CELLS);
  return centreOf(grid, path[Math.max(reach, lead)]);
}

/** True when the straight line between two points crosses no costly cell. */
function clearLine(grid: NavGrid, from: Point, to: Point): boolean {
  return lineOf(grid, from, to) === 'clear';
}

/**
 * What the straight line between two points crosses: nothing in the way,
 * only walls - a colony slides along those - or ground worth going round.
 */
function lineOf(
  grid: NavGrid,
  from: Point,
  to: Point
): 'clear' | 'walled' | 'costly' {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  const steps = Math.max(1, Math.ceil((2 * length) / grid.cell));
  let walled = false;
  for (let step = 0; step <= steps; step++) {
    const t = step / steps;
    const cost =
      grid.cost[
        cellOf(grid, {
          x: from.x + (to.x - from.x) * t,
          y: from.y + (to.y - from.y) * t,
        })
      ];
    if (cost === BLOCKED) {
      walled = true;
    } else if (cost > DETOUR_COST) {
      return 'costly';
    }
  }
  return walled ? 'walled' : 'clear';
}

function inGrid(grid: NavGrid, column: number, row: number): boolean {
  return column >= 0 && row >= 0 && column < grid.columns && row < grid.rows;
}

function cellOf(grid: NavGrid, point: Point): number {
  const column = clamp(Math.floor(point.x / grid.cell), 0, grid.columns - 1);
  const row = clamp(Math.floor(point.y / grid.cell), 0, grid.rows - 1);
  return row * grid.columns + column;
}

function centreOf(grid: NavGrid, index: number): Point {
  return {
    x: ((index % grid.columns) + 0.5) * grid.cell,
    y: (Math.floor(index / grid.columns) + 0.5) * grid.cell,
  };
}

/**
 * The open cell closest to one - itself unless a wall covers it, as the
 * centre of a colony wrapped round a wall can be. -1 on a grid all wall.
 */
function nearestOpen(grid: NavGrid, index: number): number {
  if (grid.cost[index] !== BLOCKED) {
    return index;
  }
  const column = index % grid.columns;
  const row = Math.floor(index / grid.columns);
  const most = Math.max(grid.columns, grid.rows);
  for (let ring = 1; ring < most; ring++) {
    let best = -1;
    let bestSquared = Number.POSITIVE_INFINITY;
    for (let dy = -ring; dy <= ring; dy++) {
      for (let dx = -ring; dx <= ring; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) {
          continue;
        }
        const x = column + dx;
        const y = row + dy;
        const squared = dx * dx + dy * dy;
        if (
          inGrid(grid, x, y) &&
          grid.cost[y * grid.columns + x] !== BLOCKED &&
          squared < bestSquared
        ) {
          best = y * grid.columns + x;
          bestSquared = squared;
        }
      }
    }
    if (best >= 0) {
      return best;
    }
  }
  return -1;
}

/** A binary heap of cells by travel cost, cheapest first. */
class MinQueue {
  private readonly cells: number[] = [];
  private readonly costs: number[] = [];

  public get size(): number {
    return this.cells.length;
  }

  public push(cell: number, cost: number): void {
    let i = this.cells.length;
    this.cells.push(cell);
    this.costs.push(cost);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.costs[parent] <= cost) {
        break;
      }
      this.cells[i] = this.cells[parent];
      this.costs[i] = this.costs[parent];
      i = parent;
    }
    this.cells[i] = cell;
    this.costs[i] = cost;
  }

  public pop(): [number, number] {
    const top: [number, number] = [this.cells[0], this.costs[0]];
    const lastCell = this.cells.pop() as number;
    const lastCost = this.costs.pop() as number;
    const size = this.cells.length;
    if (size > 0) {
      let i = 0;
      for (;;) {
        const left = 2 * i + 1;
        if (left >= size) {
          break;
        }
        const right = left + 1;
        const child =
          right < size && this.costs[right] < this.costs[left] ? right : left;
        if (this.costs[child] >= lastCost) {
          break;
        }
        this.cells[i] = this.cells[child];
        this.costs[i] = this.costs[child];
        i = child;
      }
      this.cells[i] = lastCell;
      this.costs[i] = lastCost;
    }
    return top;
  }
}
