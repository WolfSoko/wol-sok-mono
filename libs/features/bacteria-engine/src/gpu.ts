/**
 * The GPU mirror of the simulation (ADR 0015): the integer reference the
 * shaders are checked against (`lib/state/simulation/gpu-int/`), the grid
 * war that drives the passes (`lib/state/simulation/grid/`) and the
 * layout of the textures they share (`lib/state/simulation/grid-format.ts`).
 * Imported as `@wolsok/feat-shared-bacteria-engine/gpu` by
 * `feat-bacteria-rendering` and specs; the main entry exports none of it.
 * A name enters it with its first consumer outside the engine.
 */
export {
  frameSeed,
  PICK_OF_8_SHIFT,
  SALT,
  SALT_SPREAD,
  STEP_SALT_STRIDE,
} from './lib/state/simulation/gpu-int/draws';
export {
  chanceThreshold,
  ONE_Q14,
  Q14,
  Q14_DRAW_SHIFT,
  TARGET_SHIFT,
  toQ14,
} from './lib/state/simulation/gpu-int/fixed-point';
export {
  createIntEffectUniforms,
  INT_EFFECT_RADIUS_MAX,
  INT_MAX_EFFECTS,
  setIntEffect,
} from './lib/state/simulation/gpu-int/int-effects';
export type { IntEffect } from './lib/state/simulation/gpu-int/int-effects';
export {
  createIntFrameUniforms,
  DIVIDE_VARIANTS,
  DRAIN_SHIFT,
  fillIntCombatUniforms,
  fillIntFrameUniforms,
  INT_ATTACK_MAX,
  INT_COLONIES,
  INT_PELLETS,
} from './lib/state/simulation/gpu-int/int-frame-uniforms';
export {
  DETERMINISTIC_REPORT_LAG,
  divideBudgetOf,
  readbacksToTake,
} from './lib/state/simulation/gpu-int/int-readback';
export {
  INT_KIND,
  INT_RECORD,
  IntPassScratch,
  intStateHash,
} from './lib/state/simulation/gpu-int/int-reference';
export { intSimulation } from './lib/state/simulation/gpu-int/int-reference-passes';
export {
  intColonyCounts,
  intReferenceTick,
} from './lib/state/simulation/gpu-int/int-tick';
export type { IntTickInputs } from './lib/state/simulation/gpu-int/int-tick';
export {
  INT_EFFECTS,
  INT_ENERGY_MAX,
  intMatchUniforms,
} from './lib/state/simulation/gpu-int/int-uniforms';
export {
  GPU_SELF_TEST_VERSION,
  SELF_TEST_GOLDEN,
} from './lib/state/simulation/gpu-int/self-test-golden';
export {
  playScenario,
  scenarioRandom,
  SELF_TEST_SCENARIO,
  selfTestVerdict,
  SIM_SCENARIOS,
  skirmish,
} from './lib/state/simulation/gpu-int/sim-scenarios';
export type {
  SelfTestVerdict,
  SimScenario,
} from './lib/state/simulation/gpu-int/sim-scenarios';
export {
  ENERGY_SCALE,
  LOSER_SHIFT,
  MAX_EFFECTS,
  MAX_GPU_COLONIES,
  MAX_PELLETS,
  POISONED,
  RECORD_MASK,
  REPORT_EXTRA_ROWS,
  REPORT_ROWS,
} from './lib/state/simulation/grid-format';
export type {
  CellPasses,
  CellPassesHost,
  GridArena,
  GridFrame,
  GridTick,
  ReportSink,
} from './lib/state/simulation/grid/cell-passes';
export { GridWar, READBACK_SLOTS } from './lib/state/simulation/grid/grid-war';
