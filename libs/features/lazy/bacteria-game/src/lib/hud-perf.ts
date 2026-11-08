import type { FramePerfReport } from './arena/frame-perf';
import type { SimulationVariant } from '@wolsok/feat-shared-bacteria-engine';

/** The breakdown of a frame the HUD shows beside the frame rate. */
export interface HudPerf extends FramePerfReport {
  /** What runs the war - see {@link simulationLabel}. */
  simulation: string;
  /** The arena's cells, "640×360". */
  cells: string;
  /** The fraction of the canvas's pixels the frames are built with. */
  pixels: number;
}

const SIMULATION_LABELS: Readonly<Record<SimulationVariant, string>> = {
  cpu: 'CPU',
  'cpu-int': 'CPU int',
  'gpu-int': 'GPU int',
  'gpu-float': 'GPU float',
};

/**
 * The simulation of a match as the HUD names it: where it runs and, for a
 * grid one, whether on the integer passes - "CPU int" being the TypeScript
 * reference of the integer passes.
 */
export function simulationLabel(variant: SimulationVariant): string {
  return SIMULATION_LABELS[variant];
}

/** Milliseconds as the HUD shows them, one decimal. */
export function perfMs(ms: number): string {
  return ms.toFixed(1);
}
