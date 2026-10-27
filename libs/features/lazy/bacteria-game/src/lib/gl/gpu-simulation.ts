import type { StateLayer } from '../arena/colony-renderer';
import { escapeReach } from '../state/arena-size';
import { GameBalance } from '../state/game-balance';
import { Point } from '../state/geometry';
import { Rect } from '../state/maps';
import { frameSeed } from '../state/gpu-int/draws';
import {
  fillIntCombatUniforms,
  fillIntFrameUniforms,
} from '../state/gpu-int/int-frame-uniforms';
import { intMatchUniforms } from '../state/gpu-int/int-uniforms';
import {
  DETERMINISTIC_REPORT_LAG,
  readbacksToTake,
} from '../state/gpu-int/int-readback';
import {
  GridSimulation,
  GridSimulationOptions,
  READBACK_SLOTS,
} from '../state/grid-simulation';
import { decodeReport, ReportLayout } from '../state/simulation-report';
import { activeRects, reachSinceReport } from './active-area';
import {
  bindTexture,
  createProgram,
  createQuad,
  createTarget,
  createTexture,
  FULLSCREEN_VERTEX,
  Program,
  Target,
} from './gl-utils';
import {
  APPLY_FRAGMENT,
  CLAIM_FRAGMENT,
  COMBAT_FRAGMENT,
  CRUSH_FRAGMENT,
  EFFECTS_FRAGMENT,
  FEED_FRAGMENT,
  HUNT_COLONIES,
  HUNT_FRAGMENT,
  INFLUENCE_FRAGMENT,
  REPORT_FRAGMENT,
} from './simulation-shaders';
import {
  INT_APPLY_FRAGMENT,
  INT_CLAIM_FRAGMENT,
  INT_COMBAT_FRAGMENT,
  INT_FEED_FRAGMENT,
  INT_HUNT_FRAGMENT,
} from './int-simulation-shaders';

/**
 * Ticks the cell passes keep covering a spot after the colonies left it -
 * or after the last of a colony died there - so every state texture is
 * written empty there before the passes stop at it. One tick writes all
 * three; the others are to spare.
 */
const AREA_HISTORY = 3;
/** Ticks of reach kept - a report further behind runs the whole arena. */
const REACH_HISTORY = READBACK_SLOTS + 3;

/**
 * How fast the glow of a fight, a meal and a push fades: the share of it
 * gone after a second is 1 - e^-rate.
 */
const EFFECT_FADE_PER_SEC = { fight: 2.5, eat: 2.5, move: 6 };

/** What a pass of the claim and apply pair does. */
const KIND = { move: 0, escape: 1, divide: 2 } as const;

/**
 * The texture unit of each sampler. They are the same in every program, so
 * a texture stays bound for all passes that read it.
 */
const UNIT = {
  state: 0,
  mask: 1,
  claims: 2,
  events: 2,
  influence: 2,
  hunt: 3,
  previous: 3,
  huntMore: 4,
};

interface Programs {
  influence: Program;
  hunt: Program;
  claim: Program;
  apply: Program;
  crush: Program;
  combat: Program;
  feed: Program;
  report: Program;
  effects: Program;
}

interface Readback {
  buffer: WebGLBuffer;
  sync: WebGLSync | null;
  /** The pellets as they were when the report was rendered. */
  generation: readonly number[];
  /** The step the report was rendered in. */
  step: number;
  /** Requested in an earlier match - read, so the buffer is free, but ignored. */
  stale: boolean;
}

interface Resources {
  programs: Programs;
  quad: WebGLVertexArrayObject;
  corners: WebGLBuffer;
  /**
   * The cell state. Combat renders into one of them, which then holds the
   * frame's record of who took whom until the report is drawn; the passes
   * after it go back and forth between the other two.
   */
  states: [Target, Target, Target];
  claims: Target;
  mask: WebGLTexture;
  influence: Target;
  hunt: Target;
  /** The hunt of the third and fourth colony - see `HUNT_FRAGMENT`. */
  huntMore: Target;
  /** Ping and pong of the report, so the running totals can carry on. */
  reports: [Target, Target];
  /** Ping and pong of the glow the painter adds - see `EFFECTS_FRAGMENT`. */
  effects: [Target, Target];
  /** Read back buffers waiting to be used. */
  freeReadbacks: Readback[];
  /** Read backs the GPU works on, oldest first. */
  pendingReadbacks: Readback[];
  /** Where a finished read back lands. */
  readbackData: Uint32Array;
}

/** How a {@link GpuSimulation} runs. */
export interface GpuSimulationOptions extends GridSimulationOptions {
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
 * The colony war on the GPU - the rules of `BacteriaSimulation` as WebGL2
 * shader passes over the arena grid, in the same context the arena is
 * painted with. The painter reads the state straight from the texture, so
 * no bacterium crosses to the CPU.
 *
 * A frame runs these passes:
 * 1. the coarse density per colony, and from it the direction each colony
 *    hunts in
 * 2. escape steps for the bacteria a moved wall covers, then crushing the
 *    ones still trapped
 * 3. combat, nutrients and captures; then the food the kills leave behind
 * 4. division, as a claim and an apply pass
 * 5. movement, a claim and an apply pass per step - as many steps as the
 *    fastest colony travels cells this frame
 * 6. a small report: bacteria and energy per coarse cell, eaters per pellet
 *    and running totals of captures and losses
 *
 * The CPU reads the report back without waiting for the GPU, so the
 * scoreboard, the computer opponent and the pellets work with numbers one
 * or two frames old - or, `deterministic`, exactly
 * `DETERMINISTIC_REPORT_LAG` ticks old, waited for when the GPU is slow.
 * The walls, the gates and the pellets stay on the CPU, in
 * {@link GridSimulation}: they are a handful of rects and points.
 */
export class GpuSimulation extends GridSimulation {
  public readonly kind = 'gpu';
  private resources: Resources | null = null;
  /** The state the next pass reads. */
  private current = 0;
  /** The state combat rendered into this frame. */
  private eventsIndex = 1;
  private reportIndex = 0;
  private effectsIndex = 0;
  /**
   * How many effects this simulation last handed the passes, -1 before it
   * did in this match: the programs are shared by every simulation on the
   * context, so a match starts by handing them its count either way.
   */
  private uploadedEffects = -1;
  /** The pellet generations as of the report rendered last. */
  private renderedGeneration: readonly number[] = [];
  /** True once this match has rendered a report that can be read back. */
  private reportRendered = false;
  /**
   * Where this tick's cell passes run - see {@link activeRects}; null for
   * the whole arena.
   */
  private area: Rect[] | null = null;
  /** The colonies' own rects of the last ticks, newest first. */
  private readonly recentAreas: Rect[][] = [];
  /** How far a bacterium got in each of the last ticks, newest first. */
  private readonly recentReach: number[] = [];

  public constructor(
    private readonly gl: WebGL2RenderingContext,
    balance: GameBalance,
    random: () => number = Math.random,
    options: GpuSimulationOptions = {}
  ) {
    super(balance, random, options);
    const canvas = gl.canvas;
    if (canvas instanceof HTMLCanvasElement) {
      canvas.addEventListener('webglcontextlost', this.onContextLost);
      canvas.addEventListener('webglcontextrestored', this.onContextRestored);
    }
  }

  /** The GPU forgot everything - nothing runs until it is back. */
  private readonly onContextLost = (): void => {
    SHARED_PROGRAMS.delete(this.gl);
    FLOAT_PROGRAMS.delete(this.gl);
    INT_PROGRAMS.delete(this.gl);
    this.resources = null;
  };

  /**
   * The context is back, but empty. The war cannot be picked up where it
   * was, so the match starts over from the starting blobs.
   */
  private readonly onContextRestored = (): void => {
    if (this.width === 0 || this.height === 0) {
      return;
    }
    this.resources = this.setup();
    if (this.spawns.length > 0) {
      this.init(this.spawns);
    }
  };

  public colonyLayers(boosts: ReadonlyMap<number, Point>): StateLayer[] {
    const resources = this.resources;
    if (resources == null) {
      return [];
    }
    const state = resources.states[this.current].texture;
    const effects = resources.effects[this.effectsIndex].texture;
    return this.spawns.map((spawn, slot) => ({
      kind: 'state',
      color: spawn.color,
      boostTarget: boosts.get(spawn.playerId) ?? null,
      state,
      effects,
      owner: slot + 1,
      bounds: this.boundsOf(slot),
    }));
  }

  protected ready(): boolean {
    return this.resources != null;
  }

  protected allocate(): void {
    this.release();
    this.resources = this.setup();
  }

  protected startMatch(): void {
    this.reportRendered = false;
    this.recentAreas.length = 0;
    this.recentReach.length = 0;
    this.uploadedEffects = -1;
  }

  protected loadMask(): void {
    if (this.resources != null) {
      this.uploadMask(this.resources);
    }
  }

  protected loadState(state: Uint16Array): void {
    const resources = this.resources;
    if (resources == null) {
      return;
    }
    const gl = this.gl;
    this.current = 0;
    gl.bindTexture(gl.TEXTURE_2D, resources.states[0].texture);
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      0,
      0,
      this.width,
      this.height,
      gl.RGBA_INTEGER,
      gl.UNSIGNED_SHORT,
      state
    );
    // Fresh totals: nothing captured, nothing lost.
    const zeros = new Uint32Array(this.layout.width * this.layout.height * 4);
    for (const report of resources.reports) {
      gl.bindTexture(gl.TEXTURE_2D, report.texture);
      gl.texSubImage2D(
        gl.TEXTURE_2D,
        0,
        0,
        0,
        this.layout.width,
        this.layout.height,
        gl.RGBA_INTEGER,
        gl.UNSIGNED_INT,
        zeros
      );
    }
    // No glow left over from the last match.
    gl.clearColor(0, 0, 0, 0);
    for (const effects of resources.effects) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, effects.framebuffer);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    // Reads of the last match that are still in flight finish, but count
    // for nothing.
    for (const readback of resources.pendingReadbacks) {
      readback.stale = true;
    }
  }

  protected uploadFrame(
    deltaTimeSec: number,
    pelletCount: number,
    effectCount: number
  ): void {
    const programs = this.resources?.programs;
    if (programs == null) {
      return;
    }
    const gl = this.gl;
    const u = this.uniforms;
    if (this.deterministic) {
      this.uploadIntFrame(programs, pelletCount);
    } else {
      this.uploadFloatFrame(programs, deltaTimeSec, pelletCount);
    }
    // A plain match has no effects at all: the passes keep their count of
    // none from the last frame.
    if (effectCount > 0 || this.uploadedEffects !== 0) {
      for (const program of [programs.claim, programs.apply, programs.combat]) {
        const at = program.uniforms;
        gl.useProgram(program.program);
        if (this.deterministic) {
          gl.uniform4iv(at['uEffects[0]'], this.intEffects.circles);
          gl.uniform2iv(at['uEffectKinds[0]'], this.intEffects.kinds);
        } else {
          gl.uniform4fv(at['uEffects[0]'], u.effects);
          gl.uniform2iv(at['uEffectKinds[0]'], u.effectKinds);
        }
        gl.uniform1i(at['uEffectCount'], effectCount);
      }
      this.uploadedEffects = effectCount;
    }
    for (const program of [programs.report, programs.effects]) {
      gl.useProgram(program.program);
      gl.uniform3fv(program.uniforms['uPellets[0]'], u.pellets);
      gl.uniform1i(program.uniforms['uPelletCount'], pelletCount);
    }
  }

  protected collectReports(): void {
    if (this.resources != null) {
      this.collectReadbacks(this.resources);
    }
  }

  protected runTick(mostSteps: number, deltaTimeSec: number): void {
    const resources = this.resources;
    if (resources == null) {
      return;
    }
    const gl = this.gl;
    const { programs } = resources;
    this.updateArea(mostSteps);

    gl.disable(gl.BLEND);
    gl.disable(gl.SCISSOR_TEST);
    gl.bindVertexArray(resources.quad);
    bindTexture(gl, UNIT.mask, resources.mask, null);

    // 1. Who is where, coarsely - and where each colony hunts.
    gl.viewport(0, 0, this.layout.blocksX, this.layout.blocksY);
    this.pass(resources, programs.influence, resources.influence);
    bindTexture(gl, UNIT.influence, resources.influence.texture, null);
    gl.useProgram(programs.hunt.program);
    gl.uniform1i(programs.hunt.uniforms['uPair'], 0);
    this.pass(resources, programs.hunt, resources.hunt);
    if (this.spawns.length > HUNT_COLONIES) {
      gl.uniform1i(programs.hunt.uniforms['uPair'], 1);
      this.pass(resources, programs.hunt, resources.huntMore);
    }
    bindTexture(gl, UNIT.hunt, resources.hunt.texture, null);
    bindTexture(gl, UNIT.huntMore, resources.huntMore.texture, null);

    gl.viewport(0, 0, this.width, this.height);
    // 2. Out of the way of a wall that moved, or crushed.
    if (this.escapePending) {
      // One cell per step, as far as a wall may shove a bacterium.
      const steps = escapeReach(this.width, this.map.size);
      for (let step = 0; step < steps; step++) {
        this.claimAndApply(resources, KIND.escape, step);
      }
      this.escapePending = false;
    }
    this.statePass(resources, programs.crush);

    // 3. Combat, nutrients and captures - kept as the frame's record.
    this.eventsIndex = this.current === 0 ? 1 : 0;
    this.statePass(resources, programs.combat, this.eventsIndex);
    this.statePass(resources, programs.feed);

    // 4. Division, 5. movement.
    this.claimAndApply(resources, KIND.divide, 0);
    for (let step = 0; step < mostSteps; step++) {
      this.claimAndApply(resources, KIND.move, step);
    }
    this.renderEffects(resources, deltaTimeSec);

    // 6. The report. The one read back is last frame's, which the GPU has
    // finished by now - reading this frame's would make the driver wait.
    if (!this.deterministic) {
      this.collectReadbacks(resources);
    }
    this.requestReadback(resources);
    this.renderReport(resources);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindVertexArray(null);
  }

  /**
   * The cell state after the last tick, read back from the GPU - for the
   * self-test and the cross-check, never during a match: it waits for the
   * GPU. Null before the resources are set up.
   */
  public readState(): Uint16Array | null {
    const resources = this.resources;
    if (resources == null) {
      return null;
    }
    const gl = this.gl;
    const pixels = new Uint32Array(this.width * this.height * 4);
    gl.bindFramebuffer(
      gl.READ_FRAMEBUFFER,
      resources.states[this.current].framebuffer
    );
    gl.readPixels(
      0,
      0,
      this.width,
      this.height,
      gl.RGBA_INTEGER,
      gl.UNSIGNED_INT,
      pixels
    );
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    return Uint16Array.from(pixels);
  }

  public dispose(): void {
    const canvas = this.gl.canvas;
    if (canvas instanceof HTMLCanvasElement) {
      canvas.removeEventListener('webglcontextlost', this.onContextLost);
      canvas.removeEventListener(
        'webglcontextrestored',
        this.onContextRestored
      );
    }
    this.release();
  }

  /** Frees the textures and buffers; the context listeners stay. */
  private release(): void {
    const gl = this.gl;
    const resources = this.resources;
    this.resources = null;
    if (resources == null) {
      return;
    }
    for (const target of renderTargets(resources)) {
      gl.deleteFramebuffer(target.framebuffer);
      gl.deleteTexture(target.texture);
    }
    gl.deleteTexture(resources.mask);
    gl.deleteVertexArray(resources.quad);
    gl.deleteBuffer(resources.corners);
    for (const readback of [
      ...resources.freeReadbacks,
      ...resources.pendingReadbacks,
    ]) {
      gl.deleteBuffer(readback.buffer);
      if (readback.sync != null) {
        gl.deleteSync(readback.sync);
      }
    }
  }

  /** Hands the frame's uniforms to the float claim, apply and combat passes. */
  private uploadFloatFrame(
    programs: Programs,
    deltaTimeSec: number,
    pelletCount: number
  ): void {
    const gl = this.gl;
    const u = this.uniforms;
    for (const program of [programs.claim, programs.apply]) {
      const at = program.uniforms;
      gl.useProgram(program.program);
      gl.uniform1iv(at['uSteps[0]'], u.steps);
      gl.uniform2fv(at['uTarget[0]'], u.targets);
      gl.uniform1fv(at['uAggression[0]'], u.aggression);
      gl.uniform1fv(at['uDivideChance[0]'], u.divideChance);
      gl.uniform1fv(at['uDivideBudget[0]'], u.divideBudget);
    }
    const combat = programs.combat.uniforms;
    gl.useProgram(programs.combat.program);
    gl.uniform3fv(combat['uPellets[0]'], u.pellets);
    gl.uniform1i(combat['uPelletCount'], pelletCount);
    gl.uniform1f(combat['uDt'], deltaTimeSec);
    gl.uniform1fv(combat['uAttack[0]'], u.attack);
    gl.uniform1fv(combat['uToughness[0]'], u.toughness);
    gl.uniform1f(
      combat['uNutrientGain'],
      this.balance.nutrientDrainPerSec * deltaTimeSec
    );
  }

  /**
   * Converts the frame's uniforms into the integer passes' and hands them
   * over - the step length is a tick's, not the frame's.
   */
  private uploadIntFrame(programs: Programs, pelletCount: number): void {
    const gl = this.gl;
    const u = this.uniforms;
    const ints = fillIntCombatUniforms(
      fillIntFrameUniforms(this.intUniforms, u),
      u,
      this.balance.combatDrainPerSec,
      pelletCount
    );
    for (const program of [programs.claim, programs.apply]) {
      const at = program.uniforms;
      gl.useProgram(program.program);
      gl.uniform1iv(at['uSteps[0]'], u.steps);
      gl.uniform2iv(at['uTarget[0]'], ints.targets);
      gl.uniform1iv(at['uAggression[0]'], ints.aggression);
      gl.uniform1uiv(at['uDivideChance[0]'], ints.divideChance);
    }
    const combat = programs.combat.uniforms;
    gl.useProgram(programs.combat.program);
    gl.uniform3iv(combat['uPellets[0]'], ints.pellets);
    gl.uniform1i(combat['uPelletCount'], ints.pelletCount);
    gl.uniform1iv(combat['uAttack[0]'], ints.attack);
    gl.uniform1iv(combat['uDrain[0]'], ints.drain);
  }

  /**
   * Everything that stays the same for the whole match: the sizes, the
   * balance and which unit each sampler reads.
   */
  private setMatchUniforms(programs: Programs): void {
    const gl = this.gl;
    const b = this.balance;
    const set: SetUniforms = (program, values, ints = {}, uints = {}) => {
      gl.useProgram(program.program);
      const at = program.uniforms;
      gl.uniform1i(at['uState'], UNIT.state);
      gl.uniform1i(at['uMask'], UNIT.mask);
      gl.uniform2i(at['uSize'], this.width, this.height);
      for (const [name, value] of Object.entries(values)) {
        gl.uniform1f(at[name], value);
      }
      for (const [name, value] of Object.entries(ints)) {
        gl.uniform1i(at[name], value);
      }
      for (const [name, value] of Object.entries(uints)) {
        gl.uniform1ui(at[name], value);
      }
    };
    const cellSize = b.influenceCellSize;
    set(programs.influence, {}, { uCellSize: cellSize });
    set(programs.hunt, {}, { uInfluence: UNIT.influence });
    set(programs.crush, {});
    const samplers = {
      uCellSize: cellSize,
      uHunt: UNIT.hunt,
      uHuntMore: UNIT.huntMore,
    };
    set(programs.claim, {}, samplers);
    set(programs.apply, {}, { ...samplers, uClaims: UNIT.claims });
    set(programs.combat, {}, { uPelletRadius: b.nutrientRadius });
    set(programs.feed, {});
    if (this.deterministic) {
      this.setIntMatchUniforms(programs, set);
    } else {
      this.setFloatMatchUniforms(programs, set);
    }
    set(
      programs.report,
      {},
      {
        uCellSize: cellSize,
        uPelletRadius: b.nutrientRadius,
        uEvents: UNIT.events,
        uPrevious: UNIT.previous,
      }
    );
    set(
      programs.effects,
      {},
      {
        uPelletRadius: b.nutrientRadius,
        uEvents: UNIT.events,
        uPreviousEffects: UNIT.previous,
      }
    );
    gl.useProgram(programs.report.program);
    gl.uniform2i(
      programs.report.uniforms['uBlocks'],
      this.layout.blocksX,
      this.layout.blocksY
    );
  }

  /** The float claim, apply, combat and feed passes' match uniforms. */
  private setFloatMatchUniforms(programs: Programs, set: SetUniforms): void {
    const b = this.balance;
    const intents = {
      uJitter: b.jitter,
      uDivideThreshold: b.divideEnergyThreshold,
      uParentShare: b.parentEnergyShare,
    };
    set(programs.claim, intents);
    set(programs.apply, intents);
    set(programs.combat, {
      uDefenceFactor: b.defenceFactor,
      uFrontlinePressure: b.frontlinePressure,
      uCombatDrain: b.combatDrainPerSec,
      uRegen: b.energyRegenPerSec,
      uOverchargeDecay: b.overchargeDecayPerSec,
      uMaxEnergy: b.maxEnergy,
      uSuperMaxEnergy: b.superChargedMaxEnergy,
      uConsumeChance: b.consumeChance,
      uCaptureEnergy: b.captureEnergy,
    });
    set(programs.feed, { uFeed: b.feedEnergyPerCapture });
  }

  /**
   * The integer passes' match uniforms - every rate as what it comes to in
   * one step of a tick, see `intMatchUniforms`.
   */
  private setIntMatchUniforms(programs: Programs, set: SetUniforms): void {
    const ints = intMatchUniforms(this.balance);
    const intents = { uJitter: ints.jitter, uParentShare: ints.parentShare };
    const threshold = { uDivideThreshold: ints.divideThreshold };
    set(programs.claim, {}, intents, threshold);
    set(programs.apply, {}, intents, threshold);
    set(
      programs.combat,
      {},
      {
        uNutrientStep: ints.nutrientStep,
        uDefenceFactor: ints.defenceFactor,
        uFrontlinePressure: ints.frontlinePressure,
        uRegenStep: ints.regenStep,
        uOverchargeDecayStep: ints.overchargeDecayStep,
        uAntibioticStep: ints.antibioticStep,
        uToxinStep: ints.toxinStep,
        uMaxEnergy: ints.maxEnergy,
        uSuperMaxEnergy: ints.superMaxEnergy,
        uCaptureEnergy: ints.captureEnergy,
      },
      { uConsumeChance: ints.consumeChance }
    );
    set(programs.feed, {}, {}, { uFeed: ints.feed });
  }

  /** One claim and apply pair - a step of moving, escaping or dividing. */
  private claimAndApply(
    resources: Resources,
    kind: number,
    step: number
  ): void {
    const gl = this.gl;
    const { claim, apply } = resources.programs;
    for (const program of [claim, apply]) {
      gl.useProgram(program.program);
      gl.uniform1i(program.uniforms['uKind'], kind);
      gl.uniform1i(program.uniforms['uStep'], step);
    }
    this.pass(resources, claim, resources.claims, this.area);
    bindTexture(gl, UNIT.claims, resources.claims.texture, null);
    this.statePass(resources, apply);
  }

  /**
   * A full grid pass from the current state into another one, which is
   * current afterwards. Passes after combat leave its record alone.
   */
  private statePass(
    resources: Resources,
    program: Program,
    into = this.nextState()
  ): void {
    this.pass(resources, program, resources.states[into], this.area);
    this.current = into;
  }

  /** The state that is neither read now nor holds the frame's record. */
  private nextState(): number {
    for (let index = 0; index < 3; index++) {
      if (index !== this.current && index !== this.eventsIndex) {
        return index;
      }
    }
    return (this.current + 1) % 3;
  }

  /**
   * A pass that reads the current state, into a target - over all of it, or
   * only over the rects of `area`.
   */
  private pass(
    resources: Resources,
    program: Program,
    target: Target,
    area: readonly Rect[] | null = null
  ): void {
    const gl = this.gl;
    gl.useProgram(program.program);
    bindTexture(gl, UNIT.state, resources.states[this.current].texture, null);
    gl.uniform1ui(
      program.uniforms['uSeed'],
      this.deterministic
        ? frameSeed(this.matchSeed, this.steps)
        : (this.steps * 2654435761) >>> 0
    );
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
    if (area == null) {
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      return;
    }
    gl.enable(gl.SCISSOR_TEST);
    for (const rect of area) {
      gl.scissor(rect.x, rect.y, rect.width, rect.height);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    gl.disable(gl.SCISSOR_TEST);
  }

  /**
   * Works out where this tick's cell passes run: around the colonies as the
   * report saw them, grown by how far a bacterium gets in the ticks since -
   * a step per move, one more for a child, one to spare, and as far as a
   * wall shoves it in a tick it escapes one. The whole arena
   * runs while no report is in hand, for the first ticks, whose state
   * textures still hold the last match, while a wall shoves bacteria out of
   * the way, and when the report is further behind than the reach kept.
   *
   * Outside the area every state texture is empty and stays so through the
   * tick: the area holds every cell a bacterium may reach by the end of it,
   * and the cells of the last ticks until all three textures are written
   * empty there. The passes would only write empty over empty there, so the
   * area changes no bit of the war - the deterministic simulation runs on
   * it too, and plays as the TypeScript reference, which runs the whole
   * arena. A big map, whose colonies hold a small share of it, runs a
   * fraction of the cells.
   */
  private updateArea(mostSteps: number): void {
    const reach = this.recentReach;
    reach.unshift(
      mostSteps +
        2 +
        (this.escapePending ? escapeReach(this.width, this.map.size) : 0)
    );
    reach.length = Math.min(reach.length, REACH_HISTORY);
    const whole = [{ x: 0, y: 0, width: this.width, height: this.height }];
    const margin =
      this.report == null || this.escapePending || this.steps <= AREA_HISTORY
        ? null
        : reachSinceReport(reach, this.steps - this.reportStep);
    const own =
      this.report == null || margin === null
        ? whole
        : activeRects(
            this.report.colonies.map((colony) => colony.bounds),
            margin,
            this.width,
            this.height
          );
    const area = activeRects(
      [],
      0,
      this.width,
      this.height,
      [own, ...this.recentAreas].flat()
    );
    this.recentAreas.unshift(own);
    this.recentAreas.length = Math.min(this.recentAreas.length, AREA_HISTORY);
    this.area =
      area.length === 1 &&
      area[0].width === this.width &&
      area[0].height === this.height
        ? null
        : area;
  }

  /** Lets the glow of the last frames fade and lights what happened now. */
  private renderEffects(resources: Resources, deltaTimeSec: number): void {
    const gl = this.gl;
    const program = resources.programs.effects;
    const previous = resources.effects[this.effectsIndex];
    this.effectsIndex = 1 - this.effectsIndex;
    bindTexture(
      gl,
      UNIT.events,
      resources.states[this.eventsIndex].texture,
      null
    );
    bindTexture(gl, UNIT.previous, previous.texture, null);
    gl.useProgram(program.program);
    const fade = (rate: number) => Math.exp(-rate * deltaTimeSec);
    gl.uniform3f(
      program.uniforms['uFade'],
      fade(EFFECT_FADE_PER_SEC.fight),
      fade(EFFECT_FADE_PER_SEC.eat),
      fade(EFFECT_FADE_PER_SEC.move)
    );
    // The first frame would find every starting bacterium freshly arrived.
    gl.uniform1i(program.uniforms['uTrack'], this.steps > 1 ? 1 : 0);
    this.pass(resources, program, resources.effects[this.effectsIndex]);
  }

  private renderReport(resources: Resources): void {
    const gl = this.gl;
    const previous = resources.reports[this.reportIndex];
    this.reportIndex = 1 - this.reportIndex;
    gl.viewport(0, 0, this.layout.width, this.layout.height);
    bindTexture(
      gl,
      UNIT.events,
      resources.states[this.eventsIndex].texture,
      null
    );
    bindTexture(gl, UNIT.previous, previous.texture, null);
    this.pass(
      resources,
      resources.programs.report,
      resources.reports[this.reportIndex]
    );
    gl.viewport(0, 0, this.width, this.height);
    this.reportRendered = true;
    this.renderedGeneration = this.pellets.generations.slice();
  }

  /**
   * Queues a read back of the last frame's report into a free buffer, if
   * there is one - and if a report was rendered at all since the match
   * started: the fresh one is all zeros, and no bacteria would read as a
   * draw.
   */
  private requestReadback(resources: Resources): void {
    if (!this.reportRendered) {
      return;
    }
    // The deterministic simulation needs every report: it never runs out of
    // buffers (see DETERMINISTIC_REPORT_LAG), but takes another if it did.
    const readback =
      resources.freeReadbacks.pop() ??
      (this.deterministic ? createReadback(this.gl, this.layout) : undefined);
    if (readback == null) {
      return;
    }
    const gl = this.gl;
    gl.bindFramebuffer(
      gl.READ_FRAMEBUFFER,
      resources.reports[this.reportIndex].framebuffer
    );
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, readback.buffer);
    gl.readPixels(
      0,
      0,
      this.layout.width,
      this.layout.height,
      gl.RGBA_INTEGER,
      gl.UNSIGNED_INT,
      0
    );
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    readback.sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    // The report read is last frame's, so are the pellets it counted at.
    readback.generation = this.renderedGeneration;
    readback.step = this.steps - 1;
    readback.stale = false;
    resources.pendingReadbacks.push(readback);
    gl.flush();
  }

  /**
   * Takes in the read backs due, oldest first - see `readbacksToTake`: every
   * one the GPU has finished, or for the deterministic simulation every one
   * `DETERMINISTIC_REPORT_LAG` ticks old, finished or not. Reading an
   * unfinished one makes the driver wait for it.
   */
  private collectReadbacks(resources: Resources): void {
    const gl = this.gl;
    const data = resources.readbackData;
    const pending = resources.pendingReadbacks;
    const due = readbacksToTake(
      pending.map((readback) => ({
        step: readback.step,
        stale: readback.stale,
        ready: readback.sync == null || this.isFinished(readback.sync),
      })),
      this.steps,
      this.deterministic ? DETERMINISTIC_REPORT_LAG : null
    );
    for (let taken = 0; taken < due; taken++) {
      const readback = pending[0];
      if (readback.sync != null) {
        gl.deleteSync(readback.sync);
        readback.sync = null;
      }
      pending.shift();
      resources.freeReadbacks.push(readback);
      if (readback.stale) {
        continue;
      }
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, readback.buffer);
      gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, data);
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
      this.reportStep = readback.step;
      this.takeReport(
        decodeReport(data, this.layout, this.spawns.length),
        readback.generation
      );
    }
  }

  private isFinished(sync: WebGLSync): boolean {
    const status = this.gl.clientWaitSync(sync, 0, 0);
    return status !== this.gl.TIMEOUT_EXPIRED && status !== this.gl.WAIT_FAILED;
  }

  private uploadMask(resources: Resources): void {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, resources.mask);
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      0,
      0,
      this.width,
      this.height,
      gl.RED_INTEGER,
      gl.UNSIGNED_BYTE,
      this.mask
    );
    this.maskDirty = false;
    // Only a map with a zone to hold has its bacteria on it counted.
    const report = resources.programs.report;
    this.gl.useProgram(report.program);
    this.gl.uniform1i(report.uniforms['uCountHill'], this.hasHill ? 1 : 0);
  }

  /**
   * Allocates every texture and buffer and sets the match's uniforms; the
   * programs are compiled once per context. Throws when the GPU cannot
   * render into one of the targets - then the CPU has to run the war.
   */
  private setup(): Resources {
    const gl = this.gl;
    const programs = this.deterministic
      ? { ...compiledSharedPrograms(gl), ...compiledIntPrograms(gl) }
      : { ...compiledSharedPrograms(gl), ...compiledFloatPrograms(gl) };
    const { vao: quad, corners } = createQuad(gl);
    const state = () =>
      createTarget(gl, gl.RGBA16UI, this.width, this.height, gl.NEAREST);
    const layout = this.layout;
    const report = () =>
      createTarget(gl, gl.RGBA32UI, layout.width, layout.height, gl.NEAREST);
    // Filtered, so the painter's glow is smooth between the cells.
    const effects = () =>
      createTarget(gl, gl.RGBA8, this.width, this.height, gl.LINEAR);
    const freeReadbacks: Readback[] = Array.from(
      { length: READBACK_SLOTS },
      () => createReadback(gl, layout)
    );

    const resources: Resources = {
      programs,
      quad,
      corners,
      states: [state(), state(), state()],
      claims: createTarget(gl, gl.R8UI, this.width, this.height, gl.NEAREST),
      mask: createTexture(gl, gl.R8UI, this.width, this.height, gl.NEAREST),
      influence: createTarget(
        gl,
        gl.RGBA16UI,
        layout.blocksX,
        layout.blocksY,
        gl.NEAREST
      ),
      hunt: createTarget(
        gl,
        gl.RGBA16I,
        layout.blocksX,
        layout.blocksY,
        gl.NEAREST
      ),
      huntMore: createTarget(
        gl,
        gl.RGBA16I,
        layout.blocksX,
        layout.blocksY,
        gl.NEAREST
      ),
      reports: [report(), report()],
      effects: [effects(), effects()],
      freeReadbacks,
      pendingReadbacks: [],
      readbackData: new Uint32Array(layout.width * layout.height * 4),
    };
    // Some drivers cannot render into every integer format.
    for (const { framebuffer } of renderTargets(resources)) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      if (status !== gl.FRAMEBUFFER_COMPLETE) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        this.resources = resources;
        this.release();
        throw new Error(`A simulation target is incomplete: ${status}`);
      }
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.maskDirty = true;
    this.setMatchUniforms(programs);
    return resources;
  }
}

/** A buffer the report is read back into. */
function createReadback(
  gl: WebGL2RenderingContext,
  layout: ReportLayout
): Readback {
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.PIXEL_PACK_BUFFER, buffer);
  gl.bufferData(
    gl.PIXEL_PACK_BUFFER,
    layout.width * layout.height * 16,
    gl.STREAM_READ
  );
  gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
  return { buffer, sync: null, generation: [], step: 0, stale: false };
}

/** Every target a frame renders into. */
function renderTargets(resources: Resources): Target[] {
  return [
    ...resources.states,
    resources.claims,
    resources.influence,
    resources.hunt,
    resources.huntMore,
    ...resources.reports,
    ...resources.effects,
  ];
}

/**
 * The compiled passes of each context. Every match gets a simulation of its
 * own, but compiling the shaders again each time would stall the start of
 * every match - so they are kept until the context is lost. Both kinds of
 * simulation run the shared ones; each compiles only its own cell passes.
 */
const SHARED_PROGRAMS = new WeakMap<WebGL2RenderingContext, SharedPrograms>();

/** The float cell passes of each context. */
const FLOAT_PROGRAMS = new WeakMap<WebGL2RenderingContext, CellPrograms>();

/** The integer cell passes of each context - see `GpuSimulationOptions`. */
const INT_PROGRAMS = new WeakMap<WebGL2RenderingContext, CellPrograms>();

/**
 * Sets a pass's uniforms that stay for the match - floats, ints and uints by
 * name - besides the state, mask and size every pass reads.
 */
type SetUniforms = (
  program: Program,
  floats: Record<string, number>,
  ints?: Record<string, number>,
  uints?: Record<string, number>
) => void;

/** The cell passes, which the deterministic simulation runs in integers. */
type CellPrograms = Pick<
  Programs,
  'hunt' | 'claim' | 'apply' | 'combat' | 'feed'
>;

/** The passes both kinds of simulation run alike. */
type SharedPrograms = Omit<Programs, keyof CellPrograms>;

const COMMON_UNIFORMS = ['uState', 'uMask', 'uSize', 'uSeed'];
const WEAPON_UNIFORMS = ['uEffects[0]', 'uEffectKinds[0]', 'uEffectCount'];
/** The intents' uniforms both kinds of pass share; the float ones add the budget. */
const INTENT_UNIFORMS = [
  'uKind',
  'uStep',
  'uSteps[0]',
  'uTarget[0]',
  'uAggression[0]',
  'uJitter',
  'uCellSize',
  'uHunt',
  'uHuntMore',
  'uDivideThreshold',
  'uDivideChance[0]',
  'uParentShare',
  ...WEAPON_UNIFORMS,
];

/** Compiles a pass with the uniforms every pass has, and its own. */
function programOf(gl: WebGL2RenderingContext) {
  return (fragment: string, uniforms: string[]): Program =>
    createProgram(gl, FULLSCREEN_VERTEX, fragment, [
      ...COMMON_UNIFORMS,
      ...uniforms,
    ]);
}

function compiledIntPrograms(gl: WebGL2RenderingContext): CellPrograms {
  const cached = INT_PROGRAMS.get(gl);
  if (cached != null) {
    return cached;
  }
  const program = programOf(gl);
  const programs = {
    hunt: program(INT_HUNT_FRAGMENT, ['uInfluence', 'uPair']),
    claim: program(INT_CLAIM_FRAGMENT, INTENT_UNIFORMS),
    apply: program(INT_APPLY_FRAGMENT, [...INTENT_UNIFORMS, 'uClaims']),
    combat: program(INT_COMBAT_FRAGMENT, [
      ...WEAPON_UNIFORMS,
      'uAttack[0]',
      'uDrain[0]',
      'uPellets[0]',
      'uPelletCount',
      'uPelletRadius',
      'uNutrientStep',
      'uDefenceFactor',
      'uFrontlinePressure',
      'uRegenStep',
      'uOverchargeDecayStep',
      'uAntibioticStep',
      'uToxinStep',
      'uMaxEnergy',
      'uSuperMaxEnergy',
      'uCaptureEnergy',
      'uConsumeChance',
    ]),
    feed: program(INT_FEED_FRAGMENT, ['uFeed']),
  };
  INT_PROGRAMS.set(gl, programs);
  return programs;
}

function compiledSharedPrograms(gl: WebGL2RenderingContext): SharedPrograms {
  const cached = SHARED_PROGRAMS.get(gl);
  if (cached != null) {
    return cached;
  }
  const pellets = ['uPellets[0]', 'uPelletCount', 'uPelletRadius'];
  const program = programOf(gl);
  const programs: SharedPrograms = {
    influence: program(INFLUENCE_FRAGMENT, ['uCellSize']),
    crush: program(CRUSH_FRAGMENT, []),
    report: program(REPORT_FRAGMENT, [
      'uEvents',
      'uPrevious',
      'uCellSize',
      'uBlocks',
      'uCountHill',
      ...pellets,
    ]),
    effects: program(EFFECTS_FRAGMENT, [
      'uEvents',
      'uPreviousEffects',
      'uFade',
      'uTrack',
      ...pellets,
    ]),
  };
  SHARED_PROGRAMS.set(gl, programs);
  return programs;
}

function compiledFloatPrograms(gl: WebGL2RenderingContext): CellPrograms {
  const cached = FLOAT_PROGRAMS.get(gl);
  if (cached != null) {
    return cached;
  }
  const intents = [...INTENT_UNIFORMS, 'uDivideBudget[0]'];
  const pellets = ['uPellets[0]', 'uPelletCount', 'uPelletRadius'];
  const program = programOf(gl);
  const programs: CellPrograms = {
    hunt: program(HUNT_FRAGMENT, ['uInfluence', 'uPair']),
    claim: program(CLAIM_FRAGMENT, intents),
    apply: program(APPLY_FRAGMENT, [...intents, 'uClaims']),
    combat: program(COMBAT_FRAGMENT, [
      ...WEAPON_UNIFORMS,
      'uDt',
      'uAttack[0]',
      'uToughness[0]',
      ...pellets,
      'uNutrientGain',
      'uDefenceFactor',
      'uFrontlinePressure',
      'uCombatDrain',
      'uRegen',
      'uOverchargeDecay',
      'uMaxEnergy',
      'uSuperMaxEnergy',
      'uConsumeChance',
      'uCaptureEnergy',
    ]),
    feed: program(FEED_FRAGMENT, ['uFeed']),
  };
  FLOAT_PROGRAMS.set(gl, programs);
  return programs;
}
