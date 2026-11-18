/**
 * The layout of the grid simulation's state and report, shared by the GPU
 * passes (`gl/simulation-shaders.ts` bakes these into the GLSL) and the
 * CPU code that reads or mirrors them - the report's decoding and the
 * deterministic simulation's TypeScript run (ADR 0015).
 */

/** Fixed point scale of the energy: 1.0 is stored as 16384. */
export const ENERGY_SCALE = 16384;

/**
 * The most colonies the GPU simulation runs - four, one per channel of the
 * coarse counts and of the report's rows.
 */
export const MAX_GPU_COLONIES = 4;

/**
 * An event record: the slot + 1 of the colony that captured a cell in the
 * low bits, of the one that lost it above, and a flag for a death by
 * antibiotic above those - all within the 8 bits the effects keep.
 */
const RECORD_BITS = Math.ceil(Math.log2(MAX_GPU_COLONIES + 1));
export const RECORD_MASK = (1 << RECORD_BITS) - 1;
export const LOSER_SHIFT = RECORD_BITS;
export const POISONED = 1 << (2 * RECORD_BITS);

/** The rows of the report after the per block ones - see REPORT_FRAGMENT. */
export const REPORT_ROWS = {
  /** The pellets' eaters, and the deaths by antibiotic per column. */
  pellets: 0,
  captures: 1,
  losses: 2,
  hill: 3,
} as const;
export const REPORT_EXTRA_ROWS = Object.keys(REPORT_ROWS).length;

/** The most nutrient pellets the shaders take. */
export const MAX_PELLETS = 16;

/**
 * The most weapon effects the shaders take at once. Each seat has one
 * acting at a time at the most, a strike for a single step besides.
 */
export const MAX_EFFECTS = 4;
