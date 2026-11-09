import type { ColonySpawn } from '../bacteria-simulation';
import { Cells } from '../cells';
import { GameBalance } from '../game-balance';
import { Point } from '../geometry';
import { ENERGY_SCALE } from '../grid-format';
import type {
  CellPasses,
  GridArena,
  GridFrame,
  GridTick,
  ReportSink,
} from '../grid/cell-passes';
import { GridWar } from '../grid/grid-war';
import { CellsLayer, SimulationFactory } from '../simulation';
import { reportLayout } from '../simulation-report';
import { frameSeed } from './draws';
import {
  createIntFrameUniforms,
  fillIntCombatUniforms,
  fillIntFrameUniforms,
} from './int-frame-uniforms';
import { IntGrid, IntPassScratch } from './int-reference';
import { DETERMINISTIC_REPORT_LAG, readbacksToTake } from './int-readback';
import { intReport } from './int-report';
import {
  intReferenceTick,
  IntStateBuffers,
  IntTickInputs,
  IntTickTrace,
} from './int-tick';
import { IntMatchUniforms, intMatchUniforms } from './int-uniforms';

/** A report of a tick, waiting to be taken `DETERMINISTIC_REPORT_LAG` later. */
interface PendingReport {
  /** The tick it was rendered in. */
  step: number;
  data: Uint32Array;
  /** The pellets as they were when it was rendered. */
  generation: readonly number[];
}

/**
 * The cell passes of ADR 0015's deterministic war on the CPU: their
 * TypeScript reference (`intReferenceTick`, `intReport`) in place of the
 * GPU. It lands on the very states the integer GPU passes do, tick for
 * tick - so a device whose GPU fails the self-test, or has no WebGL2, still
 * plays a deterministic match with everybody else, and the server can play
 * one again.
 *
 * It hands the reports over as the GPU passes do in a deterministic match:
 * the one of tick `t` at the start of tick `t + DETERMINISTIC_REPORT_LAG`.
 */
export class IntReferencePasses implements CellPasses {
  public readonly variant = 'cpu-int';
  public readonly reportLag = DETERMINISTIC_REPORT_LAG;
  private arena: GridArena = {
    width: 0,
    height: 0,
    layout: reportLayout(0, 0, 1),
  };
  private state: Uint16Array = new Uint16Array(0);
  private mask: Uint8Array = new Uint8Array(0);
  private hasHill = false;
  private scratch = new IntPassScratch(0, 0);
  private buffers = new IntStateBuffers(0);
  /** The reports' buffers - see `takeReportBuffer`. */
  private reportBuffers: Uint32Array[] = [];
  /** What the painter gets - see `collectBacterias`. */
  private readonly bacterias: Cells[] = [];
  private drawnState: Uint16Array | null = null;
  /** Ticks run, to draw each one once - see `colonyLayers`. */
  private ticks = 0;
  private drawnTick = -1;
  private readonly match: IntMatchUniforms;
  private readonly intUniforms = createIntFrameUniforms();
  private readonly trace: IntTickTrace = { combat: null };
  private frame: GridFrame | null = null;
  private previousReport: Uint32Array | null = null;
  private readonly pendingReports: PendingReport[] = [];
  private allocated = false;

  public constructor(
    private readonly balance: GameBalance,
    private readonly matchSeed = 0
  ) {
    this.match = intMatchUniforms(balance);
  }

  /** Nothing to restart: the CPU loses no resources. */
  public attach(): void {
    // The CPU keeps its arrays for as long as the war runs.
  }

  public ready(): boolean {
    return this.allocated;
  }

  public allocate(arena: GridArena): void {
    const { width, height, layout } = arena;
    this.arena = arena;
    this.state = new Uint16Array(width * height * 4);
    this.scratch = new IntPassScratch(width, height);
    this.buffers = new IntStateBuffers(this.state.length);
    const reportLength = layout.width * layout.height * 4;
    // The reports in flight, the last one and the one being written.
    this.reportBuffers = Array.from(
      { length: DETERMINISTIC_REPORT_LAG + 2 },
      () => new Uint32Array(reportLength)
    );
    this.allocated = width > 0 && height > 0;
  }

  public startMatch(): void {
    this.pendingReports.length = 0;
    this.previousReport = null;
  }

  public loadMask(mask: Uint8Array, hasHill: boolean): void {
    this.mask = mask;
    this.hasHill = hasHill;
  }

  public loadState(state: Uint16Array): void {
    this.state = state;
  }

  public uploadFrame(frame: GridFrame): void {
    this.frame = frame;
  }

  public collectReports(step: number, sink: ReportSink): void {
    const pending = this.pendingReports;
    const due = readbacksToTake(
      pending.map((report) => ({
        step: report.step,
        ready: true,
        stale: false,
      })),
      step,
      DETERMINISTIC_REPORT_LAG
    );
    for (const report of pending.splice(0, due)) {
      sink.take(report.data, report.step, report.generation);
    }
  }

  public runTick(tick: GridTick): void {
    const frame = this.frame;
    if (frame == null) {
      return;
    }
    const { width, height, layout } = this.arena;
    const grid: IntGrid = { width, height, state: this.state, mask: this.mask };
    this.state = intReferenceTick(
      grid,
      this.tickInputs(tick, frame),
      this.scratch,
      this.trace,
      this.buffers
    );
    this.ticks++;
    const events = this.trace.combat ?? this.state;
    const report = intReport(
      { ...grid, state: this.state },
      events,
      layout,
      {
        pellets: frame.uniforms.pellets,
        pelletCount: frame.pelletCount,
        pelletRadius: this.balance.nutrientRadius,
        countHill: this.hasHill,
      },
      this.previousReport,
      this.takeReportBuffer()
    );
    this.previousReport = report;
    this.pendingReports.push({
      step: tick.step,
      data: report,
      generation: tick.generation.slice(),
    });
  }

  public colonyLayers(
    colonies: readonly ColonySpawn[],
    boosts: ReadonlyMap<number, Point>
  ): CellsLayer[] {
    if (this.drawnState !== this.state || this.drawnTick !== this.ticks) {
      this.collectBacterias(colonies.length);
    }
    return colonies.map((spawn, slot) => ({
      kind: 'cells',
      color: spawn.color,
      boostTarget: boosts.get(spawn.playerId) ?? null,
      cells: this.bacterias[slot],
    }));
  }

  public readState(): Uint16Array | null {
    return this.allocated ? this.state.slice() : null;
  }

  public dispose(): void {
    this.pendingReports.length = 0;
  }

  /**
   * The bacteria of each colony as the painter takes them, once per tick
   * whatever the frame rate: the columns are kept and refilled, so
   * drawing allocates nothing once they are big enough. A
   * layer `colonyLayers` returned changes with the next tick - copy what
   * has to outlast it.
   */
  private collectBacterias(slots: number): void {
    const lists = this.bacterias;
    for (let slot = 0; slot < slots; slot++) {
      (lists[slot] ??= new Cells()).length = 0;
    }
    const state = this.state;
    const { width, height } = this.arena;
    for (let cell = 0; cell < width * height; cell++) {
      const owner = state[cell * 4];
      if (owner === 0 || owner > slots) {
        continue;
      }
      const x = cell % width;
      const y = (cell - x) / width;
      lists[owner - 1].push(x, y, state[cell * 4 + 1] / ENERGY_SCALE);
    }
    this.drawnState = this.state;
    this.drawnTick = this.ticks;
  }

  /**
   * A report buffer neither a pending report nor the last report holds.
   * At most `DETERMINISTIC_REPORT_LAG` reports wait at once, so one is
   * always free; should more ever wait, another buffer is made rather than
   * a waiting report overwritten.
   */
  private takeReportBuffer(): Uint32Array {
    const pending = this.pendingReports;
    for (const buffer of this.reportBuffers) {
      if (
        buffer !== this.previousReport &&
        !pending.some((report) => report.data === buffer)
      ) {
        return buffer;
      }
    }
    const { layout } = this.arena;
    const buffer = new Uint32Array(layout.width * layout.height * 4);
    this.reportBuffers.push(buffer);
    return buffer;
  }

  /**
   * The tick's inputs from the frame, as the GPU passes take them with
   * integer rules.
   */
  private tickInputs(tick: GridTick, frame: GridFrame): IntTickInputs {
    const u = frame.uniforms;
    const ints = fillIntCombatUniforms(
      fillIntFrameUniforms(this.intUniforms, u),
      u,
      this.balance.combatDrainPerSec,
      frame.pelletCount
    );
    const match = this.match;
    return {
      pass: {
        ...ints,
        steps: u.steps,
        seed: frameSeed(this.matchSeed, tick.step),
        jitter: match.jitter,
        divideThreshold: match.divideThreshold,
        parentShare: match.parentShare,
        cellSize: this.balance.influenceCellSize,
        effects: frame.intEffects,
      },
      combat: { frame: ints, pelletRadius: this.balance.nutrientRadius },
      match,
      moveSteps: tick.mostSteps,
      escapeSteps: tick.escapeSteps,
    };
  }
}

/**
 * The deterministic war on the CPU: a {@link GridWar} over the integer
 * reference passes - see {@link IntReferencePasses}.
 */
export const intSimulation = ((balance, random, seed) =>
  new GridWar(
    new IntReferencePasses(balance, seed),
    balance,
    random
  )) satisfies SimulationFactory;
