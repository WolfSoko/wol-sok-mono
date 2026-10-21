/**
 * How the computer finds its way: a coarse grid over the arena that knows
 * the walls and what each zone costs to cross, a flood of travel distances
 * out from the bot's colony, and the waypoint it sends its crosshair to so
 * the colony goes round a wall instead of piling up in front of it.
 *
 * Pure and deterministic, so a recorded match plays out the same again.
 */

import { BASE_ARENA } from './arena-size';
import { clamp, distance, Point } from './geometry';
import { Rect, stampRect } from './maps';
import {
  kindOfCode,
  stampZones,
  Zone,
  ZONE_CODE,
  ZONE_EFFECTS,
  ZoneKind,
} from './zones';

/** Cells of the base arena per side of a grid cell. */
export const NAV_CELL = 4;

/** The cost of crossing a cell of each kind of zone, 1 for plain ground. */
const ZONE_COST: Readonly<Record<ZoneKind, number>> = {
  // Kills a colony that lingers - only worth crossing to save a long way.
  antibiotic: 8,
  // As much slower as the bacteria on it sit their steps out.
  ice: 1 / (1 - ZONE_EFFECTS.iceStayChance),
  agar: 0.8,
  heat: 1,
  hill: 1,
};

/** {@link ZONE_COST} by zone code, 1 for no zone. */
const COST_BY_CODE: readonly number[] = Array.from(
  { length: Math.max(...Object.values(ZONE_CODE)) + 1 },
  (_, code) => {
    const kind = kindOfCode(code);
    return kind === undefined ? 1 : ZONE_COST[kind];
  }
);

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
  /** The arena it covers, in arena cells. */
  width: number;
  height: number;
  columns: number;
  rows: number;
  /** Arena cells per side of a grid cell. */
  cell: number;
  /** Cost per grid cell, {@link BLOCKED} for a wall. */
  cost: Float32Array;
}

/**
 * The grid of an arena of that size: a cell is blocked where walls cover
 * most of it, and costs what the zone under its centre costs - laid out by
 * the same stamping the simulations use.
 */
export function navGrid(
  width: number,
  height: number,
  walls: readonly Rect[],
  zones: readonly Zone[],
  /** Arena cells per base cell - a nav cell is as big on every grid. */
  unit = width / BASE_ARENA.width
): NavGrid {
  const cell = Math.max(1, NAV_CELL * unit);
  const columns = Math.ceil(width / cell);
  const rows = Math.ceil(height / cell);
  const grid: NavGrid = {
    width,
    height,
    columns,
    rows,
    cell,
    cost: new Float32Array(columns * rows),
  };
  const codes = new Uint8Array(width * height);
  stampZones(codes, width, height, zones);
  for (let index = 0; index < grid.cost.length; index++) {
    grid.cost[index] = COST_BY_CODE[codes[arenaIndex(grid, index)]];
  }
  blockWalls(grid, grid.cost, walls);
  return grid;
}

/** The grid with these walls blocked as well - gates and sliding walls. */
export function withWalls(grid: NavGrid, walls: readonly Rect[]): NavGrid {
  if (walls.length === 0) {
    return grid;
  }
  const cost = grid.cost.slice();
  blockWalls(grid, cost, walls);
  return { ...grid, cost };
}

/**
 * Blocks the cells of `cost` that walls cover for the most part - a cell
 * half open still lets a thin channel through, as it does the bacteria.
 */
function blockWalls(
  grid: NavGrid,
  cost: Float32Array,
  walls: readonly Rect[]
): void {
  const { width, height, columns, cell } = grid;
  const solid = new Uint8Array(width * height);
  for (const wall of walls) {
    stampRect(solid, width, height, wall, 1);
  }
  const covered = new Uint16Array(cost.length);
  const area = new Uint16Array(cost.length);
  for (let y = 0; y < height; y++) {
    const row = Math.floor(y / cell) * columns;
    for (let x = 0; x < width; x++) {
      const index = row + Math.floor(x / cell);
      area[index]++;
      covered[index] += solid[y * width + x];
    }
  }
  for (let index = 0; index < cost.length; index++) {
    if (2 * covered[index] > area[index]) {
      cost[index] = BLOCKED;
    }
  }
}

/** The arena cell at the centre of a grid cell, as an index into the arena. */
function arenaIndex(grid: NavGrid, index: number): number {
  const x = Math.min(
    grid.width - 1,
    Math.floor(((index % grid.columns) + 0.5) * grid.cell)
  );
  const y = Math.min(
    grid.height - 1,
    Math.floor((Math.floor(index / grid.columns) + 0.5) * grid.cell)
  );
  return y * grid.width + x;
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
  if (field.start < 0) {
    return to;
  }
  let goal = nearestOpen(grid, cellOf(grid, to));
  if (goal < 0 || !isFinite(field.distance[goal])) {
    // Out of reach - behind a shut gate, say: as close as the colony gets,
    // rather than into the wall.
    goal = closestReached(field, to);
    to = centreOf(grid, goal);
  }
  const from = centreOf(grid, field.start);
  const line = lineOf(grid, from, to);
  if (
    line === 'clear' ||
    (line === 'walled' &&
      field.distance[goal] <= distance(from, to) * DETOUR_LIMIT)
  ) {
    return to;
  }
  const path: number[] = [];
  for (let index = goal; index >= 0; index = field.previous[index]) {
    path.push(index);
  }
  path.reverse();
  let reach = 0;
  while (
    reach + 1 < path.length &&
    lineOf(grid, from, centreOf(grid, path[reach + 1])) === 'clear'
  ) {
    reach++;
  }
  const lead = Math.min(path.length - 1, LEAD_CELLS);
  return centreOf(grid, path[Math.max(reach, lead)]);
}

/**
 * What the straight line between two points crosses: nothing in the way,
 * only walls - a colony slides along those - or ground worth going round.
 * The ground at either end does not count: there is no way round what the
 * colony stands on, or what it is after.
 */
export function lineOf(
  grid: NavGrid,
  from: Point,
  to: Point
): 'clear' | 'walled' | 'costly' {
  const steps = Math.max(1, Math.ceil((2 * distance(from, to)) / grid.cell));
  const first = cellOf(grid, from);
  const last = cellOf(grid, to);
  let walled = false;
  let previous = first;
  for (let step = 0; step <= steps; step++) {
    const t = step / steps;
    const index = cellAt(
      grid,
      from.x + (to.x - from.x) * t,
      from.y + (to.y - from.y) * t
    );
    const cost = grid.cost[index];
    if (cost === BLOCKED || cutsCorner(grid, previous, index)) {
      walled = true;
    } else if (cost > DETOUR_COST && index !== first && index !== last) {
      return 'costly';
    }
    previous = index;
  }
  return walled ? 'walled' : 'clear';
}

/**
 * True for a diagonal step between two cells whose shared corner two
 * walls meet at - a seam the flood does not pass either.
 */
function cutsCorner(grid: NavGrid, from: number, to: number): boolean {
  const fromColumn = from % grid.columns;
  const toColumn = to % grid.columns;
  const fromRow = Math.floor(from / grid.columns);
  const toRow = Math.floor(to / grid.columns);
  return (
    fromColumn !== toColumn &&
    fromRow !== toRow &&
    (grid.cost[fromRow * grid.columns + toColumn] === BLOCKED ||
      grid.cost[toRow * grid.columns + fromColumn] === BLOCKED)
  );
}

/** The cell the flood reached that lies closest to a point. */
function closestReached(field: NavField, to: Point): number {
  let best = field.start;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < field.distance.length; index++) {
    if (!isFinite(field.distance[index])) {
      continue;
    }
    const gap = distance(centreOf(field.grid, index), to);
    if (gap < bestDistance) {
      best = index;
      bestDistance = gap;
    }
  }
  return best;
}

function inGrid(grid: NavGrid, column: number, row: number): boolean {
  return column >= 0 && row >= 0 && column < grid.columns && row < grid.rows;
}

function cellOf(grid: NavGrid, point: Point): number {
  return cellAt(grid, point.x, point.y);
}

function cellAt(grid: NavGrid, x: number, y: number): number {
  const column = clamp(Math.floor(x / grid.cell), 0, grid.columns - 1);
  const row = clamp(Math.floor(y / grid.cell), 0, grid.rows - 1);
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
  // Rare - a scan of the whole grid is cheap enough.
  const column = index % grid.columns;
  const row = Math.floor(index / grid.columns);
  let best = -1;
  let bestSquared = Number.POSITIVE_INFINITY;
  for (let other = 0; other < grid.cost.length; other++) {
    if (grid.cost[other] === BLOCKED) {
      continue;
    }
    const dx = (other % grid.columns) - column;
    const dy = Math.floor(other / grid.columns) - row;
    const squared = dx * dx + dy * dy;
    if (squared < bestSquared) {
      best = other;
      bestSquared = squared;
    }
  }
  return best;
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
