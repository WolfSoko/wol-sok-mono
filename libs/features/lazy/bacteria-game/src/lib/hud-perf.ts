import type { FramePerfReport } from './arena/frame-perf';
import type { Ruleset, Simulation } from './state/simulation';

/** The breakdown of a frame the HUD shows beside the frame rate. */
export interface HudPerf extends FramePerfReport {
  /** What runs the war - see {@link simulationLabel}. */
  simulation: string;
  /** The arena's cells, "640×360". */
  cells: string;
  /** The fraction of the canvas's pixels the frames are built with. */
  pixels: number;
}

/**
 * The simulation of a match as the HUD names it: where it runs and, for a
 * GPU one, whether on the integer passes - "GPU int", "GPU float", "CPU",
 * or "CPU int" for the TypeScript reference of the integer passes.
 */
export function simulationLabel(
  kind: Simulation['kind'],
  ruleset: Ruleset | null
): string {
  switch (kind) {
    case 'gpu':
      return ruleset === 'gpu-int' ? 'GPU int' : 'GPU float';
    case 'int':
      return 'CPU int';
    default:
      return 'CPU';
  }
}

/** Milliseconds as the HUD shows them, one decimal. */
export function perfMs(ms: number): string {
  return ms.toFixed(1);
}
