import { escapeReach } from '../arena-size';
import { GameBalance } from '../game-balance';
import { Point } from '../geometry';
import { ENERGY_SCALE } from '../grid-format';
import { Bacteria } from '../player.model';
import { CellsLayer, SimulationFactory } from '../simulation';
import { decodeReport } from '../simulation-report';
import { GridSimulation } from '../grid-simulation';
import { frameSeed } from './draws';
import {
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
 * The deterministic simulation of ADR 0015 on the CPU: the walls, pellets,
 * effects and uniforms of {@link GridSimulation}, with the cell passes and
 * the report run by their TypeScript reference (`intReferenceTick`,
 * `intReport`) instead of the GPU. It lands on the very states the integer
 * GPU passes do, tick for tick - so a device whose GPU fails the self-test,
 * or has no WebGL2, still plays a deterministic match with everybody else,
 * and the server can play one again.
 *
 * It takes the reports as `GpuSimulation` does in a deterministic match:
 * the one of tick `t` at the start of tick `t + DETERMINISTIC_REPORT_LAG`.
 */
export class IntSimulation extends GridSimulation {
  public readonly kind = 'int';
  private state: Uint16Array = new Uint16Array(0);
  private scratch = new IntPassScratch(0, 0);
  private buffers = new IntStateBuffers(0);
  /** The reports' buffers - see `takeReportBuffer`. */
  private reportBuffers: Uint32Array[] = [];
  /** What the painter gets - see `collectBacterias`. */
  private readonly bacterias: Bacteria[][] = [];
  private bacteriaCounts = new Int32Array(0);
  private drawnState: Uint16Array | null = null;
  private drawnStep = -1;
  private readonly match: IntMatchUniforms;
  private readonly trace: IntTickTrace = { combat: null };
  private pelletCount = 0;
  private previousReport: Uint32Array | null = null;
  private readonly pendingReports: PendingReport[] = [];
  private allocated = false;

  public constructor(
    balance: GameBalance,
    random: () => number = Math.random,
    matchSeed = 0
  ) {
    super(balance, random, { deterministic: true, matchSeed });
    this.match = intMatchUniforms(balance);
  }

  /** The cell state after the last tick - see `GpuSimulation.readState`. */
  public readState(): Uint16Array | null {
    return this.allocated ? this.state.slice() : null;
  }

  public colonyLayers(boosts: ReadonlyMap<number, Point>): CellsLayer[] {
    if (this.drawnState !== this.state || this.drawnStep !== this.steps) {
      this.collectBacterias();
    }
    return this.spawns.map((spawn, slot) => ({
      kind: 'cells',
      color: spawn.color,
      boostTarget: boosts.get(spawn.playerId) ?? null,
      bacterias: this.bacterias[slot],
    }));
  }

  public dispose(): void {
    this.pendingReports.length = 0;
  }

  protected ready(): boolean {
    return this.allocated;
  }

  protected allocate(): void {
    this.state = new Uint16Array(this.width * this.height * 4);
    this.scratch = new IntPassScratch(this.width, this.height);
    this.buffers = new IntStateBuffers(this.state.length);
    const reportLength = this.layout.width * this.layout.height * 4;
    // The reports in flight, the last one and the one being written.
    this.reportBuffers = Array.from(
      { length: DETERMINISTIC_REPORT_LAG + 2 },
      () => new Uint32Array(reportLength)
    );
    this.allocated = this.width > 0 && this.height > 0;
  }

  protected startMatch(): void {
    this.pendingReports.length = 0;
    this.previousReport = null;
  }

  protected loadMask(): void {
    this.maskDirty = false;
  }

  protected loadState(state: Uint16Array): void {
    this.state = state;
  }

  protected uploadFrame(_deltaTimeSec: number, pelletCount: number): void {
    this.pelletCount = pelletCount;
  }

  protected collectReports(): void {
    const pending = this.pendingReports;
    const due = readbacksToTake(
      pending.map(({ step }) => ({ step, ready: true, stale: false })),
      this.steps,
      DETERMINISTIC_REPORT_LAG
    );
    for (const report of pending.splice(0, due)) {
      this.reportStep = report.step;
      this.takeReport(
        decodeReport(report.data, this.layout, this.spawns.length),
        report.generation
      );
    }
  }

  protected runTick(mostSteps: number): void {
    const grid: IntGrid = {
      width: this.width,
      height: this.height,
      state: this.state,
      mask: this.mask,
    };
    this.state = intReferenceTick(
      grid,
      this.tickInputs(mostSteps),
      this.scratch,
      this.trace,
      this.buffers
    );
    this.escapePending = false;
    const events = this.trace.combat ?? this.state;
    const report = intReport(
      { ...grid, state: this.state },
      events,
      this.layout,
      {
        pellets: this.uniforms.pellets,
        pelletCount: this.pelletCount,
        pelletRadius: this.balance.nutrientRadius,
        countHill: this.hasHill,
      },
      this.previousReport,
      this.takeReportBuffer()
    );
    this.previousReport = report;
    this.pendingReports.push({
      step: this.steps,
      data: report,
      generation: this.pellets.generations.slice(),
    });
  }

  /**
   * The bacteria of each colony as the painter takes them, once per tick
   * whatever the frame rate: the objects are kept and refilled, as
   * `BacteriaSimulation` keeps its own, so drawing allocates nothing. A
   * layer `colonyLayers` returned changes with the next tick - copy what
   * has to outlast it.
   */
  private collectBacterias(): void {
    const slots = this.spawns.length;
    const lists = this.bacterias;
    while (lists.length < slots) {
      lists.push([]);
    }
    if (this.bacteriaCounts.length !== slots) {
      this.bacteriaCounts = new Int32Array(slots);
    }
    const counts = this.bacteriaCounts.fill(0);
    const state = this.state;
    const width = this.width;
    for (let cell = 0; cell < width * this.height; cell++) {
      const owner = state[cell * 4];
      if (owner === 0 || owner > slots) {
        continue;
      }
      const list = lists[owner - 1];
      const x = cell % width;
      const y = (cell - x) / width;
      const energy = state[cell * 4 + 1] / ENERGY_SCALE;
      const bacteria = list[counts[owner - 1]++];
      if (bacteria == null) {
        list.push({ x, y, energy });
      } else {
        bacteria.x = x;
        bacteria.y = y;
        bacteria.energy = energy;
      }
    }
    for (let slot = 0; slot < slots; slot++) {
      lists[slot].length = counts[slot];
    }
    this.drawnState = this.state;
    this.drawnStep = this.steps;
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
    const buffer = new Uint32Array(this.layout.width * this.layout.height * 4);
    this.reportBuffers.push(buffer);
    return buffer;
  }

  /**
   * The tick's inputs from the frame's uniforms, as `GpuSimulation` hands
   * them to its integer passes.
   */
  private tickInputs(mostSteps: number): IntTickInputs {
    const u = this.uniforms;
    const frame = fillIntCombatUniforms(
      fillIntFrameUniforms(this.intUniforms, u),
      u,
      this.balance.combatDrainPerSec,
      this.pelletCount
    );
    const match = this.match;
    const effects = this.intEffects;
    return {
      pass: {
        ...frame,
        steps: u.steps,
        seed: frameSeed(this.matchSeed, this.steps),
        jitter: match.jitter,
        divideThreshold: match.divideThreshold,
        parentShare: match.parentShare,
        cellSize: this.balance.influenceCellSize,
        effects,
      },
      combat: { frame, pelletRadius: this.balance.nutrientRadius },
      match,
      moveSteps: mostSteps,
      escapeSteps: this.escapePending
        ? escapeReach(this.width, this.map.size)
        : 0,
    };
  }
}

/** The deterministic simulation on the CPU - see {@link IntSimulation}. */
export const intSimulation: SimulationFactory = (balance, random, seed) =>
  new IntSimulation(balance, random, seed);
