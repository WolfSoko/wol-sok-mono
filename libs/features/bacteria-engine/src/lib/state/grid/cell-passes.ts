import type { ColonySpawn } from '../bacteria-simulation';
import type { CellBounds, Point } from '../geometry';
import type { IntEffectUniforms } from '../gpu-int/int-effects';
import type { ColonyLayer, GridVariant } from '../simulation';
import type { Report, ReportLayout } from '../simulation-report';

/** The uniform arrays of a frame, filled in place by `GridWar`. */
export interface FrameUniforms {
  steps: Int32Array;
  targets: Float32Array;
  aggression: Float32Array;
  attack: Float32Array;
  divideChance: Float32Array;
  divideBudget: Float32Array;
  pellets: Float32Array;
  toughness: Float32Array;
  /**
   * Per effect: its centre, its radius squared and 1 for a hostile one -
   * acting on every colony but its owner's - else 0.
   */
  effects: Float32Array;
  /** Per effect: the weapon's code and the owner's slot + 1. */
  effectKinds: Int32Array;
}

/** The arena the passes run on, as `GridWar` sized it. */
export interface GridArena {
  width: number;
  height: number;
  /** The report's coarse blocks - see `reportLayout`. */
  layout: ReportLayout;
}

/**
 * A frame's inputs, filled in place by `GridWar` before each tick: the
 * float uniforms, and the integer circles of the weapons' effects. The
 * integer passes convert the rest themselves (`fillIntFrameUniforms`).
 */
export interface GridFrame {
  deltaTimeSec: number;
  uniforms: FrameUniforms;
  intEffects: IntEffectUniforms;
  pelletCount: number;
  effectCount: number;
}

/** What a tick's cell passes read of the war besides the frame. */
export interface GridTick {
  /** Steps run in this match, this one included. */
  step: number;
  /** The most cells a colony travels this tick. */
  mostSteps: number;
  /** Escape steps to run first - 0 unless a wall moved since the last tick. */
  escapeSteps: number;
  /** The colonies in the match. */
  colonies: number;
  /** The report in hand, null before the first. */
  report: Report | null;
  /** The step the report in hand was rendered in. */
  reportStep: number;
  /** The pellets' generations now - copy what has to outlast the tick. */
  generation: readonly number[];
}

/**
 * Where the passes hand the reports they read back, oldest first: the raw
 * report of `step`, and the pellets' generations as it was rendered.
 */
export interface ReportSink {
  take(data: Uint32Array, step: number, generation: readonly number[]): void;
}

/** What the passes may ask of the war they run. */
export interface CellPassesHost {
  /**
   * Starts the match over from the starting blobs - after the passes lost
   * their resources (a lost WebGL context) and set them up again.
   */
  restart(): void;
}

/**
 * The cell passes of the grid war and the report they render: everything of
 * `GridWar` that touches the bacteria. Three adapters run them - the
 * integer reference on the CPU (`IntReferencePasses`), and the game's GPU
 * passes with integer or float rules. Each reads only what the calls hand
 * it, never a field of the war.
 */
export interface CellPasses {
  /** Which grid simulation these passes run - see `SimulationVariant`. */
  readonly variant: GridVariant;
  /**
   * How old, in ticks, every report the war takes is - set only by the
   * integer passes of ADR 0015, which every device computes alike
   * (`DETERMINISTIC_REPORT_LAG`): the war then collects them at the start of
   * a tick and plays the `gpu-int` ruleset. Null for passes that hand
   * reports over as they come in, during `runTick`.
   */
  readonly reportLag: number | null;
  /** Called once by the war that runs these passes. */
  attach(host: CellPassesHost): void;
  /** True once the passes can run - their resources are set up. */
  ready(): boolean;
  /** Sets up what the passes need for an arena; throws when it cannot. */
  allocate(arena: GridArena): void;
  /** Starts a match over - what the passes keep of the last one goes. */
  startMatch(): void;
  /** The walls and zones, after a wall moved or a match started. */
  loadMask(mask: Uint8Array, hasHill: boolean): void;
  /** Makes `state` the state the next tick starts from. */
  loadState(state: Uint16Array): void;
  /** Hands the passes this tick's frame - before `runTick`. */
  uploadFrame(frame: GridFrame): void;
  /** Hands the reports due by `step` to the sink - passes with a `reportLag`. */
  collectReports(step: number, sink: ReportSink): void;
  /**
   * Runs the tick's cell passes and renders its report; passes that are not
   * deterministic hand the reports read back to the sink here.
   */
  runTick(tick: GridTick, sink: ReportSink): void;
  /** The colonies as the painter draws them. */
  colonyLayers(
    colonies: readonly ColonySpawn[],
    boosts: ReadonlyMap<number, Point>,
    boundsOf: (slot: number) => CellBounds | null
  ): ColonyLayer[];
  /** The cell state after the last tick - see `GridWar.readState`. */
  readState(): Uint16Array | null;
  /** Milliseconds waited for the GPU since the last call - absent on the CPU. */
  takeGpuWaitMs?(): number;
  dispose(): void;
}
