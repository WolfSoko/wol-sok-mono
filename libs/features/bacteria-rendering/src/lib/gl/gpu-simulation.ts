import { GameBalance, GridWar } from '@wolsok/feat-shared-bacteria-engine';
import { GpuCellPasses } from './gpu-cell-passes';
import { GpuFloatRules, GpuIntRules } from './gpu-rules';

/** How a GPU simulation runs - see {@link gpuSimulation}. */
export interface GpuSimulationOptions {
  /**
   * Runs the war as the integer passes of ADR 0015, which every GPU
   * computes alike, with draws seeded from `matchSeed` and every step as
   * long as a tick. Nothing the passes read follows the GPU's timing: the
   * report the colony counts, the pellets and the bots go by is always the
   * one of `DETERMINISTIC_REPORT_LAG` ticks ago - waited for when the GPU is
   * slow - and the cell passes cover the whole arena. Off by default.
   */
  deterministic?: boolean;
  /** The match's seed - see `MatchPlan.seed`. */
  matchSeed?: number;
}

/**
 * The colony war on the GPU of `gl`: a `GridWar` over the GPU's cell
 * passes, by the integer rules of ADR 0015 with `deterministic`, the float
 * ones else - see {@link GpuCellPasses}.
 */
export function gpuSimulation(
  gl: WebGL2RenderingContext,
  balance: GameBalance,
  random: () => number = Math.random,
  options: GpuSimulationOptions = {}
): GridWar {
  const rules = options.deterministic
    ? new GpuIntRules(balance, options.matchSeed ?? 0)
    : new GpuFloatRules(balance);
  return new GridWar(new GpuCellPasses(gl, balance, rules), balance, random);
}
