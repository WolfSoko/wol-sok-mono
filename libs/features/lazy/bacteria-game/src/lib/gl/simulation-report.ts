import { CellBounds, Point } from '../state/geometry';
import {
  ENERGY_SCALE,
  MAX_GPU_COLONIES,
  MAX_PELLETS,
} from './simulation-shaders';

/** How the GPU report texture is laid out - see `REPORT_FRAGMENT`. */
export interface ReportLayout {
  /** Coarse cells across and down. */
  blocksX: number;
  blocksY: number;
  /** Arena cells per coarse cell along each axis. */
  cellSize: number;
  width: number;
  height: number;
  /** The arena, to clip the coarse cells at its edge. */
  arenaWidth: number;
  arenaHeight: number;
}

/** The layout of the report for an arena of that size. */
export function reportLayout(
  arenaWidth: number,
  arenaHeight: number,
  cellSize: number
): ReportLayout {
  const blocksX = Math.ceil(arenaWidth / cellSize);
  const blocksY = Math.ceil(arenaHeight / cellSize);
  return {
    blocksX,
    blocksY,
    cellSize,
    width: Math.max(blocksX, MAX_PELLETS),
    height: blocksY + 2,
    arenaWidth,
    arenaHeight,
  };
}

/** One colony as the report shows it. */
export interface ColonyReport {
  count: number;
  totalEnergy: number;
  /** Centre of mass, to the precision of the coarse cells. */
  center: Point | null;
  /** The coarse cells it covers, in arena cells. */
  bounds: CellBounds | null;
  /** Running totals since the match started. */
  captured: number;
  lost: number;
}

/** Everything the CPU learns from one read back of the report. */
export interface Report {
  colonies: ColonyReport[];
  /** Bacteria within reach of each pellet. */
  eaters: number[];
  /** Bacteria per colony per coarse cell, for the nearest enemy. */
  blockCounts: Uint32Array[];
  /** Bacteria an antibiotic killed since the match started, all colonies. */
  poisoned: number;
}

/** Turns the raw read back - four 32 bit integers per texel - into numbers. */
export function decodeReport(data: Uint32Array, layout: ReportLayout): Report {
  const { blocksX, blocksY, cellSize, width } = layout;
  const colonies: ColonyReport[] = [];
  const blockCounts: Uint32Array[] = [];
  for (let slot = 0; slot < MAX_GPU_COLONIES; slot++) {
    const counts = new Uint32Array(blocksX * blocksY);
    let count = 0;
    let energy = 0;
    let sumX = 0;
    let sumY = 0;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (let by = 0; by < blocksY; by++) {
      for (let bx = 0; bx < blocksX; bx++) {
        const texel = (by * width + bx) * 4;
        const n = data[texel + slot];
        if (n === 0) {
          continue;
        }
        counts[by * blocksX + bx] = n;
        count += n;
        energy += data[texel + 2 + slot];
        sumX += n * blockCenter(bx, cellSize, layout.arenaWidth);
        sumY += n * blockCenter(by, cellSize, layout.arenaHeight);
        minX = Math.min(minX, bx);
        minY = Math.min(minY, by);
        maxX = Math.max(maxX, bx);
        maxY = Math.max(maxY, by);
      }
    }

    let captured = 0;
    let lost = 0;
    const totalsRow = blocksY + 1;
    for (let bx = 0; bx < blocksX; bx++) {
      const texel = (totalsRow * width + bx) * 4;
      captured += data[texel + slot];
      lost += data[texel + 2 + slot];
    }

    blockCounts.push(counts);
    colonies.push({
      count,
      totalEnergy: energy / ENERGY_SCALE,
      center: count > 0 ? { x: sumX / count, y: sumY / count } : null,
      bounds:
        count > 0
          ? {
              minX: minX * cellSize,
              minY: minY * cellSize,
              maxX: Math.min(layout.arenaWidth, (maxX + 1) * cellSize) - 1,
              maxY: Math.min(layout.arenaHeight, (maxY + 1) * cellSize) - 1,
            }
          : null,
      captured,
      lost,
    });
  }

  const eaters: number[] = [];
  for (let i = 0; i < MAX_PELLETS; i++) {
    eaters.push(data[(blocksY * width + i) * 4]);
  }
  let poisoned = 0;
  for (let bx = 0; bx < blocksX; bx++) {
    poisoned += data[(blocksY * width + bx) * 4 + 1];
  }
  return { colonies, eaters, blockCounts, poisoned };
}

/**
 * The centre of the closest coarse cell that holds bacteria of any other
 * colony - the nearest enemy, to within a few cells.
 */
export function nearestEnemyBlock(
  report: Report,
  layout: ReportLayout,
  ownSlot: number,
  from: Point
): Point | null {
  let nearest: Point | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  report.blockCounts.forEach((counts, slot) => {
    if (slot === ownSlot) {
      return;
    }
    for (let i = 0; i < counts.length; i++) {
      if (counts[i] === 0) {
        continue;
      }
      const x = blockCenter(
        i % layout.blocksX,
        layout.cellSize,
        layout.arenaWidth
      );
      const y = blockCenter(
        Math.floor(i / layout.blocksX),
        layout.cellSize,
        layout.arenaHeight
      );
      const squared = (x - from.x) ** 2 + (y - from.y) ** 2;
      if (squared < nearestDistance) {
        nearestDistance = squared;
        nearest = { x, y };
      }
    }
  });
  return nearest;
}

/** The middle of a coarse cell, clipped to the arena. */
function blockCenter(block: number, cellSize: number, size: number): number {
  const start = block * cellSize;
  const end = Math.min(size, start + cellSize);
  return (start + end - 1) / 2;
}
