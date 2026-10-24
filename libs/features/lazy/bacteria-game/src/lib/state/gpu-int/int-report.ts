import { ZONE_CODE, ZONE_SHIFT } from '../zones';
import {
  LOSER_SHIFT,
  MAX_GPU_COLONIES,
  POISONED,
  RECORD_MASK,
  REPORT_ROWS,
} from '../grid-format';
import { ReportLayout } from '../simulation-report';
import { IntGrid } from './int-reference';

/** What the report pass reads besides the state, the record and the mask. */
export interface IntReportInputs {
  /**
   * Per pellet: x and y in cells and its amount flag - the float uniform
   * `uPellets`, taken as 32 bit floats and truncated to the cell as the
   * shader's `ivec2(...)` does.
   */
  pellets: ArrayLike<number>;
  pelletCount: number;
  /** Chebyshev reach of a pellet. */
  pelletRadius: number;
  /** True on a map with a zone to hold - `uCountHill`. */
  countHill: boolean;
}

/**
 * `REPORT_FRAGMENT` in TypeScript: the raw report - four uints per texel,
 * as the GPU reads it back - of the state at the end of a tick (`grid`)
 * and the record combat left in `events`, carrying the running totals on
 * from `previous` (the last report, all zeros at the start of a match).
 * `decodeReport` turns it into numbers either way.
 *
 * The sums are counts, so the order they are added in changes nothing;
 * the code counts cell by cell rather than texel by texel, as the GPU does.
 */
export function intReport(
  grid: IntGrid,
  events: Uint16Array,
  layout: ReportLayout,
  inputs: IntReportInputs,
  previous: Uint32Array | null,
  out: Uint32Array = new Uint32Array(layout.width * layout.height * 4)
): Uint32Array {
  const { width, height, state, mask } = grid;
  const { blocksX, blocksY, cellSize } = layout;
  const texel = (x: number, y: number) => (y * layout.width + x) * 4;
  out.fill(0);

  // Per coarse cell: the bacteria of each colony, then their energy.
  for (let y = 0; y < height; y++) {
    const by = Math.floor(y / cellSize);
    for (let x = 0; x < width; x++) {
      const at = (y * width + x) * 4;
      const owner = state[at];
      if (owner === 0) {
        continue;
      }
      const bx = Math.floor(x / cellSize);
      out[texel(bx, by) + owner - 1]++;
      const energy = texel(bx, blocksY + by) + owner - 1;
      out[energy] = (out[energy] + state[at + 1]) >>> 0;
    }
  }

  // The rows below: captures and losses run on from the last report, the
  // deaths by antibiotic too, the hold zone is counted afresh.
  const pelletRow = 2 * blocksY;
  const carried = [
    REPORT_ROWS.pellets,
    REPORT_ROWS.captures,
    REPORT_ROWS.losses,
  ];
  if (previous != null) {
    for (const row of carried) {
      const start = texel(0, pelletRow + row);
      out.set(previous.subarray(start, start + layout.width * 4), start);
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width && x < blocksX * cellSize; x++) {
      const cell = y * width + x;
      const column = Math.floor(x / cellSize);
      const record = events[cell * 4 + 3];
      const add = (row: number, slot: number) => {
        const at = texel(column, pelletRow + row) + slot - 1;
        out[at] = (out[at] + 1) >>> 0;
      };
      if ((record & POISONED) !== 0) {
        add(REPORT_ROWS.pellets, 2);
      }
      const capturer = record & RECORD_MASK;
      if (capturer !== 0) {
        add(REPORT_ROWS.captures, capturer);
      }
      const loser = (record >> LOSER_SHIFT) & RECORD_MASK;
      if (loser !== 0) {
        add(REPORT_ROWS.losses, loser);
      }
      const owner = state[cell * 4];
      if (
        inputs.countHill &&
        owner !== 0 &&
        mask[cell] >> ZONE_SHIFT === ZONE_CODE.hill
      ) {
        add(REPORT_ROWS.hill, owner);
      }
    }
  }

  // The pellets' eaters ride along in the row of the deaths by antibiotic.
  const radius = inputs.pelletRadius;
  for (let i = 0; i < layout.width; i++) {
    const byColony = [0, 0, 0, 0];
    if (i < inputs.pelletCount) {
      const px = Math.trunc(Math.fround(inputs.pellets[i * 3]));
      const py = Math.trunc(Math.fround(inputs.pellets[i * 3 + 1]));
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const x = px + dx;
          const y = py + dy;
          if (x < 0 || y < 0 || x >= width || y >= height) {
            continue;
          }
          const owner = state[(y * width + x) * 4];
          if (owner > 0 && owner <= MAX_GPU_COLONIES) {
            byColony[owner - 1]++;
          }
        }
      }
    }
    const at = texel(i, pelletRow + REPORT_ROWS.pellets);
    out[at + 2] = (byColony[0] | (byColony[1] << 16)) >>> 0;
    out[at + 3] = (byColony[2] | (byColony[3] << 16)) >>> 0;
  }
  return out;
}
