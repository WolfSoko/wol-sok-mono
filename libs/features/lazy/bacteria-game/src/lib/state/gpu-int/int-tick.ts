import { IntMatchUniforms } from './int-uniforms';
import {
  IntCombatUniforms,
  intClaimAndApply,
  intCombat,
  intCrush,
  intFeed,
  IntGrid,
  intHunt,
  intInfluence,
  INT_KIND,
  IntPassScratch,
  IntPassUniforms,
} from './int-reference';

/**
 * Everything one tick of the deterministic GPU simulation reads besides
 * the state (ADR 0015): the uniforms of its passes and how many steps they
 * take. A tick is a function of the state and these alone - what the CPU
 * makes of the reports is already folded into them, from the report of
 * `DETERMINISTIC_REPORT_LAG` ticks ago (see `int-readback.ts`).
 */
export interface IntTickInputs {
  pass: IntPassUniforms;
  combat: Omit<IntCombatUniforms, 'seed' | 'effects' | 'match'>;
  match: IntMatchUniforms;
  /** Claim and apply steps of moving - the most any colony takes. */
  moveSteps: number;
  /** Claim and apply steps of escaping a wall that moved, 0 for none. */
  escapeSteps: number;
}

/** What a tick leaves besides its state - see {@link intReferenceTick}. */
export interface IntTickTrace {
  /** The state right after combat, whose record the report counts. */
  combat: Uint16Array | null;
}

/**
 * The state buffers a tick writes into, reused from tick to tick - see
 * {@link intReferenceTick}. A state it returned, and the record after
 * combat (`IntTickTrace.combat`), stay as they are until the next tick
 * with the same buffers runs.
 */
export class IntStateBuffers {
  private readonly a: Uint16Array;
  private readonly b: Uint16Array;
  public readonly combat: Uint16Array;

  public constructor(length: number) {
    this.a = new Uint16Array(length);
    this.b = new Uint16Array(length);
    this.combat = new Uint16Array(length);
  }

  /** A buffer to write the pass after `source` into - never `source`. */
  public after(source: Uint16Array): Uint16Array {
    return source === this.a ? this.b : this.a;
  }
}

/**
 * One tick of the deterministic GPU simulation in TypeScript, in the order
 * `GpuSimulation.step` runs its passes: the hunt, escaping a wall, crushing,
 * combat, feeding, division and the steps of moving. Returns the new state.
 * A `trace` gets the state after combat.
 *
 * Without `buffers` every pass writes a new array and the grid's state is
 * left alone; with them the passes take turns in the same few, so a match
 * allocates no state per tick - and a grid state that is one of them is
 * overwritten.
 */
export function intReferenceTick(
  grid: IntGrid,
  inputs: IntTickInputs,
  scratch: IntPassScratch = new IntPassScratch(grid.width, grid.height),
  trace?: IntTickTrace,
  buffers?: IntStateBuffers
): Uint16Array {
  const { pass } = inputs;
  const blocksX = Math.ceil(grid.width / pass.cellSize);
  const blocksY = Math.ceil(grid.height / pass.cellSize);
  const hunt = intHunt(intInfluence(grid, pass.cellSize), blocksX, blocksY);
  // One grid for every pass, its state swapped in as the passes go.
  const shared: IntGrid = { ...grid };
  const at = (state: Uint16Array): IntGrid => {
    shared.state = state;
    return shared;
  };
  const next = (source: Uint16Array) =>
    buffers?.after(source) ?? new Uint16Array(source.length);
  let state = grid.state;
  for (let step = 0; step < inputs.escapeSteps; step++) {
    state = intClaimAndApply(
      at(state),
      pass,
      hunt,
      INT_KIND.escape,
      step,
      scratch,
      next(state)
    );
  }
  state = intCrush(at(state), next(state));
  state = intCombat(
    at(state),
    {
      ...inputs.combat,
      seed: pass.seed,
      match: inputs.match,
      effects: pass.effects,
    },
    buffers?.combat ?? new Uint16Array(state.length)
  );
  if (trace != null) {
    trace.combat = state;
  }
  state = intFeed(at(state), inputs.match.feed, next(state));
  state = intClaimAndApply(
    at(state),
    pass,
    hunt,
    INT_KIND.divide,
    0,
    scratch,
    next(state)
  );
  for (let step = 0; step < inputs.moveSteps; step++) {
    state = intClaimAndApply(
      at(state),
      pass,
      hunt,
      INT_KIND.move,
      step,
      scratch,
      next(state)
    );
  }
  return state;
}

/** Bacteria per colony, slot 0 first - what a report counts. */
export function intColonyCounts(
  state: ArrayLike<number>,
  colonies: number
): number[] {
  const counts = new Array<number>(colonies).fill(0);
  for (let at = 0; at < state.length; at += 4) {
    const owner = state[at];
    if (owner > 0 && owner <= colonies) {
      counts[owner - 1]++;
    }
  }
  return counts;
}
