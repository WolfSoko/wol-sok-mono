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
 * One tick of the deterministic GPU simulation in TypeScript, in the order
 * `GpuSimulation.step` runs its passes: the hunt, escaping a wall, crushing,
 * combat, feeding, division and the steps of moving. Returns the new state;
 * the grid's is left alone. A `trace` gets the state after combat.
 */
export function intReferenceTick(
  grid: IntGrid,
  inputs: IntTickInputs,
  scratch: IntPassScratch = new IntPassScratch(grid.width, grid.height),
  trace?: IntTickTrace
): Uint16Array {
  const { pass } = inputs;
  const blocksX = Math.ceil(grid.width / pass.cellSize);
  const blocksY = Math.ceil(grid.height / pass.cellSize);
  const hunt = intHunt(intInfluence(grid, pass.cellSize), blocksX, blocksY);
  const at = (state: Uint16Array): IntGrid => ({ ...grid, state });
  let state = grid.state;
  for (let step = 0; step < inputs.escapeSteps; step++) {
    state = intClaimAndApply(
      at(state),
      pass,
      hunt,
      INT_KIND.escape,
      step,
      scratch
    );
  }
  state = intCrush(at(state));
  state = intCombat(at(state), {
    ...inputs.combat,
    seed: pass.seed,
    match: inputs.match,
    effects: pass.effects,
  });
  if (trace != null) {
    trace.combat = state;
  }
  state = intFeed(at(state), inputs.match.feed);
  state = intClaimAndApply(at(state), pass, hunt, INT_KIND.divide, 0, scratch);
  for (let step = 0; step < inputs.moveSteps; step++) {
    state = intClaimAndApply(
      at(state),
      pass,
      hunt,
      INT_KIND.move,
      step,
      scratch
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
