import type { StateLayer } from '../arena/colony-renderer';
import {
  ColonySpawn,
  colonyIntent,
  noEvents,
  Nutrient,
  StepEvents,
} from '../state/bacteria-simulation';
import { colonyCapacity, GameBalance } from '../state/game-balance';
import { CellBounds, clamp, Point } from '../state/geometry';
import {
  compareDynamicWalls,
  DynamicWall,
  GameMap,
  getMap,
  stampRect,
} from '../state/maps';
import { NutrientPellets } from '../state/nutrient-pellets';
import { createBacteriaBlob, isBoosted, Player } from '../state/player.model';
import { ColonySummary, Simulation } from '../state/simulation';
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
  ENERGY_SCALE,
  FEED_FRAGMENT,
  HUNT_FRAGMENT,
  INFLUENCE_FRAGMENT,
  MAX_GPU_COLONIES,
  MAX_PELLETS,
  REPORT_FRAGMENT,
} from './simulation-shaders';
import {
  decodeReport,
  nearestEnemyBlock,
  Report,
  ReportLayout,
  reportLayout,
} from './simulation-report';

/** How many steps a moving wall may shove a bacterium before it crushes it. */
const ESCAPE_STEPS = 3;

/**
 * The most cells a colony travels in one frame - each one is a claim and an
 * apply pass. Enough for a boosted colony at 30 frames a second; on a device
 * slower than that the colonies slow down instead of every frame taking
 * longer than the last.
 */
const MAX_MOVE_STEPS = 12;

/** Read backs in flight at once - the GPU is a frame or two behind. */
const READBACK_SLOTS = 3;

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
}

interface Readback {
  buffer: WebGLBuffer;
  sync: WebGLSync | null;
  /** The pellets as they were when the report was rendered. */
  generation: readonly number[];
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
  /** Ping and pong of the report, so the running totals can carry on. */
  reports: [Target, Target];
  /** Read back buffers waiting to be used. */
  freeReadbacks: Readback[];
  /** Read backs the GPU works on, oldest first. */
  pendingReadbacks: Readback[];
  /** Where a finished read back lands. */
  readbackData: Uint32Array;
}

/** The uniform arrays of a frame, filled in place. */
interface FrameUniforms {
  steps: Int32Array;
  targets: Float32Array;
  aggression: Float32Array;
  attack: Float32Array;
  canDivide: Int32Array;
  pellets: Float32Array;
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
 * or two frames old. The walls, the gates and the pellets stay on the CPU:
 * they are a handful of rects and points.
 */
export class GpuSimulation implements Simulation {
  public readonly kind = 'gpu';
  private resources: Resources | null = null;
  private width = 0;
  private height = 0;
  private layout: ReportLayout;
  private map: GameMap = getMap('corridors');
  private elapsedSec = 0;
  private frame = 0;
  /** The state the next pass reads. */
  private current = 0;
  /** The state combat rendered into this frame. */
  private eventsIndex = 1;
  private reportIndex = 0;
  private spawns: ColonySpawn[] = [];
  private dynamicWalls: DynamicWall[] = [];
  private mask = new Uint8Array(0);
  private staticMask = new Uint8Array(0);
  private maskDirty = true;
  private escapePending = false;
  private readonly pellets: NutrientPellets;
  /** The pellet generations as of the report rendered last. */
  private renderedGeneration: readonly number[] = [];
  private events: StepEvents = noEvents();
  private report: Report | null = null;
  private colonySummaries: ColonySummary[] = [];
  /** Totals of the last report, to turn them into this frame's events. */
  private reported = { captured: 0, lost: 0 };
  /** Seconds the pellets have not been drained for, waiting on a report. */
  private undrainedSec = 0;
  /** True once this match has rendered a report that can be read back. */
  private reportRendered = false;
  /** The most cells each colony gets per frame, boosted - for its box. */
  private readonly reach = new Int32Array(MAX_GPU_COLONIES).fill(
    MAX_MOVE_STEPS
  );
  private readonly uniforms: FrameUniforms = {
    steps: new Int32Array(MAX_GPU_COLONIES),
    targets: new Float32Array(MAX_GPU_COLONIES * 2),
    aggression: new Float32Array(MAX_GPU_COLONIES),
    attack: new Float32Array(MAX_GPU_COLONIES),
    canDivide: new Int32Array(MAX_GPU_COLONIES),
    pellets: new Float32Array(MAX_PELLETS * 3),
  };

  public constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly balance: GameBalance,
    random: () => number = Math.random
  ) {
    this.pellets = new NutrientPellets(balance, random);
    this.layout = reportLayout(0, 0, balance.influenceCellSize);
    const canvas = gl.canvas;
    if (canvas instanceof HTMLCanvasElement) {
      canvas.addEventListener('webglcontextlost', this.onContextLost);
      canvas.addEventListener('webglcontextrestored', this.onContextRestored);
    }
  }

  /** The GPU forgot everything - nothing runs until it is back. */
  private readonly onContextLost = (): void => {
    PROGRAMS.delete(this.gl);
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

  /** The state slot of a player's colony, null when it has none. */
  public slotOf(playerId: number): number | null {
    const slot = this.spawns.findIndex((spawn) => spawn.playerId === playerId);
    return slot < 0 ? null : slot;
  }

  public colonyLayers(boosted: ReadonlySet<number>): StateLayer[] {
    const state = this.resources?.states[this.current].texture;
    if (state == null) {
      return [];
    }
    return this.spawns.map((spawn, slot) => ({
      kind: 'state',
      color: spawn.color,
      boosted: boosted.has(spawn.playerId),
      state,
      owner: slot + 1,
      bounds: this.boundsOf(slot),
    }));
  }

  /** Takes effect with the next `init`, which lays out walls and pellets. */
  public setMap(map: GameMap): void {
    this.map = map;
  }

  public resize(width: number, height: number): void {
    if (this.width === width && this.height === height) {
      return;
    }
    this.width = width;
    this.height = height;
    this.layout = reportLayout(width, height, this.balance.influenceCellSize);
    this.release();
    this.resources = this.setup();
    if (this.spawns.length > 0) {
      this.init(this.spawns);
    }
  }

  public init(spawns: ColonySpawn[]): void {
    if (spawns.length > MAX_GPU_COLONIES) {
      throw new Error(
        `The GPU simulation runs ${MAX_GPU_COLONIES} colonies, not ${spawns.length}`
      );
    }
    this.spawns = spawns;
    this.elapsedSec = 0;
    this.frame = 0;
    this.events = noEvents();
    this.report = null;
    this.reported = { captured: 0, lost: 0 };
    this.undrainedSec = 0;
    this.reportRendered = false;
    this.buildMask();
    this.pellets.reset(this.width, this.height, this.isOpenCell);
    this.uploadSpawns(spawns);
  }

  public getNutrients(): Nutrient[] {
    return this.pellets.nutrients;
  }

  public getDynamicWalls(): readonly DynamicWall[] {
    return this.dynamicWalls;
  }

  public getEvents(): StepEvents {
    return this.events;
  }

  public summaries(): readonly ColonySummary[] {
    return this.colonySummaries;
  }

  public nearestEnemy(playerId: number, from: Point): Point | null {
    const slot = this.slotOf(playerId);
    if (this.report == null || slot == null) {
      return null;
    }
    return nearestEnemyBlock(this.report, this.layout, slot, from);
  }

  public step(players: Player[], deltaTimeSec: number): void {
    this.events = noEvents();
    const resources = this.resources;
    if (resources == null || this.spawns.length === 0 || deltaTimeSec <= 0) {
      return;
    }
    const gl = this.gl;
    const { programs } = resources;
    this.elapsedSec += deltaTimeSec;
    this.frame++;
    this.advanceDynamicWalls();
    if (this.maskDirty) {
      this.uploadMask(resources);
    }
    this.tickPellets(deltaTimeSec);
    const mostSteps = this.fillFrameUniforms(players, deltaTimeSec);

    gl.disable(gl.BLEND);
    gl.disable(gl.SCISSOR_TEST);
    gl.bindVertexArray(resources.quad);
    bindTexture(gl, UNIT.mask, resources.mask, null);

    // 1. Who is where, coarsely - and where each colony hunts.
    gl.viewport(0, 0, this.layout.blocksX, this.layout.blocksY);
    this.pass(resources, programs.influence, resources.influence);
    bindTexture(gl, UNIT.influence, resources.influence.texture, null);
    this.pass(resources, programs.hunt, resources.hunt);
    bindTexture(gl, UNIT.hunt, resources.hunt.texture, null);

    gl.viewport(0, 0, this.width, this.height);
    // 2. Out of the way of a wall that moved, or crushed.
    if (this.escapePending) {
      for (let step = 0; step < ESCAPE_STEPS; step++) {
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

    // 6. The report. The one read back is last frame's, which the GPU has
    // finished by now - reading this frame's would make the driver wait.
    this.collectReadbacks(resources);
    this.requestReadback(resources);
    this.renderReport(resources);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindVertexArray(null);
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

  /**
   * The box around a colony, for the painter to scissor to. The report is a
   * frame or two old, so the box is grown by how far the colony gets in the
   * frames its read back may take.
   */
  private boundsOf(slot: number): CellBounds | null {
    const bounds =
      this.report == null
        ? this.spawnBounds(slot)
        : (this.report.colonies[slot]?.bounds ?? null);
    if (bounds == null) {
      return null;
    }
    const margin = this.reach[slot] * READBACK_SLOTS;
    return {
      minX: clamp(bounds.minX - margin, 0, this.width - 1),
      minY: clamp(bounds.minY - margin, 0, this.height - 1),
      maxX: clamp(bounds.maxX + margin, 0, this.width - 1),
      maxY: clamp(bounds.maxY + margin, 0, this.height - 1),
    };
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

  /**
   * Fills the uniform arrays of this frame and hands them to the passes that
   * read them - they keep their values until the next frame. Returns the
   * most cells a colony travels.
   */
  private fillFrameUniforms(players: Player[], deltaTimeSec: number): number {
    const gl = this.gl;
    const b = this.balance;
    const u = this.uniforms;
    const programs = this.resources?.programs;
    if (programs == null) {
      return 0;
    }
    const capacity = colonyCapacity(b, this.spawns.length);
    u.steps.fill(0);
    u.targets.fill(NaN);
    u.canDivide.fill(0);
    this.spawns.forEach((spawn, slot) => {
      const target = players.find((player) => player.id === spawn.playerId);
      const intent = colonyIntent(target, b, deltaTimeSec);
      u.aggression[slot] = intent?.aggression ?? b.aggression;
      u.attack[slot] = isBoosted(target ?? null) ? b.boostAttackFactor : 1;
      u.canDivide[slot] =
        (this.colonySummaries[slot]?.count ?? 0) < capacity ? 1 : 0;
      if (target == null || intent == null) {
        return;
      }
      u.steps[slot] = Math.min(MAX_MOVE_STEPS, intent.steps);
      u.targets[slot * 2] = target.x;
      u.targets[slot * 2 + 1] = target.y;
      this.reach[slot] = Math.min(
        MAX_MOVE_STEPS,
        Math.max(
          1,
          Math.round(target.maxSpeed * b.boostSpeedFactor * deltaTimeSec)
        )
      );
    });

    const nutrients = this.pellets.nutrients;
    u.pellets.fill(0);
    nutrients.slice(0, MAX_PELLETS).forEach((pellet, n) => {
      u.pellets[n * 3] = pellet.x;
      u.pellets[n * 3 + 1] = pellet.y;
      u.pellets[n * 3 + 2] = pellet.amount > 0 ? 1 : 0;
    });
    const pelletCount = Math.min(nutrients.length, MAX_PELLETS);

    for (const program of [programs.claim, programs.apply]) {
      const at = program.uniforms;
      gl.useProgram(program.program);
      gl.uniform1iv(at['uSteps[0]'], u.steps);
      gl.uniform2fv(at['uTarget[0]'], u.targets);
      gl.uniform1fv(at['uAggression[0]'], u.aggression);
      gl.uniform1iv(at['uCanDivide[0]'], u.canDivide);
      gl.uniform1f(at['uDivideChance'], b.divideChancePerSec * deltaTimeSec);
    }
    for (const program of [programs.combat, programs.report]) {
      gl.useProgram(program.program);
      gl.uniform3fv(program.uniforms['uPellets[0]'], u.pellets);
      gl.uniform1i(program.uniforms['uPelletCount'], pelletCount);
    }
    const combat = programs.combat.uniforms;
    gl.useProgram(programs.combat.program);
    gl.uniform1f(combat['uDt'], deltaTimeSec);
    gl.uniform1fv(combat['uAttack[0]'], u.attack);
    gl.uniform1f(combat['uNutrientGain'], b.nutrientDrainPerSec * deltaTimeSec);
    return Math.max(0, ...u.steps);
  }

  /**
   * Everything that stays the same for the whole match: the sizes, the
   * balance and which unit each sampler reads.
   */
  private setMatchUniforms(programs: Programs): void {
    const gl = this.gl;
    const b = this.balance;
    const set = (
      program: Program,
      values: Record<string, number>,
      ints: Record<string, number> = {}
    ) => {
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
    };
    const intents = {
      uJitter: b.jitter,
      uDivideThreshold: b.divideEnergyThreshold,
      uParentShare: b.parentEnergyShare,
    };
    const cellSize = b.influenceCellSize;
    set(programs.influence, {}, { uCellSize: cellSize });
    set(programs.hunt, {}, { uInfluence: UNIT.influence });
    set(programs.claim, intents, { uCellSize: cellSize, uHunt: UNIT.hunt });
    set(programs.apply, intents, {
      uCellSize: cellSize,
      uHunt: UNIT.hunt,
      uClaims: UNIT.claims,
    });
    set(programs.crush, {});
    set(
      programs.combat,
      {
        uDefenceFactor: b.defenceFactor,
        uFrontlinePressure: b.frontlinePressure,
        uCombatDrain: b.combatDrainPerSec,
        uRegen: b.energyRegenPerSec,
        uOverchargeDecay: b.overchargeDecayPerSec,
        uMaxEnergy: b.maxEnergy,
        uSuperMaxEnergy: b.superChargedMaxEnergy,
        uConsumeChance: b.consumeChance,
        uCaptureEnergy: b.captureEnergy,
      },
      { uPelletRadius: b.nutrientRadius }
    );
    set(programs.feed, { uFeed: b.feedEnergyPerCapture });
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
    gl.useProgram(programs.report.program);
    gl.uniform2i(
      programs.report.uniforms['uBlocks'],
      this.layout.blocksX,
      this.layout.blocksY
    );
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
    this.pass(resources, claim, resources.claims);
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
    this.pass(resources, program, resources.states[into]);
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

  /** A pass that reads the current state, into a target. */
  private pass(resources: Resources, program: Program, target: Target): void {
    const gl = this.gl;
    gl.useProgram(program.program);
    bindTexture(gl, UNIT.state, resources.states[this.current].texture, null);
    gl.uniform1ui(program.uniforms['uSeed'], (this.frame * 2654435761) >>> 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
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
    const readback = resources.freeReadbacks.pop();
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
    readback.stale = false;
    resources.pendingReadbacks.push(readback);
    gl.flush();
  }

  /**
   * Takes in every read back the GPU has finished, oldest first. The GPU
   * finishes them in order, so the first unfinished one ends the round.
   */
  private collectReadbacks(resources: Resources): void {
    const gl = this.gl;
    const data = resources.readbackData;
    const pending = resources.pendingReadbacks;
    while (pending.length > 0) {
      const readback = pending[0];
      const sync = readback.sync;
      if (sync != null) {
        const status = gl.clientWaitSync(sync, 0, 0);
        if (status === gl.TIMEOUT_EXPIRED || status === gl.WAIT_FAILED) {
          return;
        }
        gl.deleteSync(sync);
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
      this.takeReport(decodeReport(data, this.layout), readback.generation);
    }
  }

  /** Turns a report into the scoreboard, the frame's events and the eaters. */
  private takeReport(report: Report, generation: readonly number[]): void {
    this.report = report;
    this.colonySummaries = this.spawns.map((spawn, index) => {
      const colony = report.colonies[index];
      return {
        playerId: spawn.playerId,
        color: spawn.color,
        count: colony.count,
        captured: colony.captured,
        lost: colony.lost,
        totalEnergy: colony.totalEnergy,
        center: colony.center,
      };
    });

    const captured = report.colonies.reduce((sum, c) => sum + c.captured, 0);
    const lost = report.colonies.reduce((sum, c) => sum + c.lost, 0);
    const newCaptures = captured - this.reported.captured;
    const newLosses = lost - this.reported.lost;
    this.events.captures += newCaptures;
    // A loss nobody captured is a bacterium a wall crushed.
    this.events.crushed += Math.max(0, newLosses - newCaptures);
    this.reported = { captured, lost };

    // The eaters drain the pellets for all the time since the last report,
    // however many frames that was.
    const gain = this.balance.nutrientDrainPerSec * this.undrainedSec;
    this.undrainedSec = 0;
    this.pellets.nutrients.forEach((_, n) => {
      if (generation[n] !== this.pellets.generations[n]) {
        // The pellet moved since this report was taken.
        return;
      }
      if (this.pellets.drain(n, report.eaters[n] ?? 0, gain)) {
        this.events.pelletsEaten++;
      }
    });
  }

  /** Counts eaten pellets' respawn delays down and brings them back. */
  private tickPellets(deltaTimeSec: number): void {
    this.undrainedSec += deltaTimeSec;
    this.pellets.nutrients.forEach((nutrient, n) => {
      if (nutrient.amount <= 0) {
        this.pellets.tickEmpty(n, deltaTimeSec);
      }
    });
  }

  private readonly isOpenCell = (x: number, y: number): boolean =>
    this.mask[y * this.width + x] === 0;

  /** Moves the gates and sliding walls on and notes what they did. */
  private advanceDynamicWalls(): void {
    if (this.map.createDynamicWalls == null) {
      return;
    }
    const previous = this.dynamicWalls;
    this.dynamicWalls = this.map.createDynamicWalls(
      this.width,
      this.height,
      this.elapsedSec
    );
    const { changed, closed, warned } = compareDynamicWalls(
      previous,
      this.dynamicWalls
    );
    this.events.gatesClosed += closed;
    this.events.gatesWarned += warned;
    if (changed) {
      this.stampMask();
      this.escapePending = true;
    }
  }

  /** The static walls, and the moving ones as of the match time. */
  private buildMask(): void {
    this.staticMask = new Uint8Array(this.width * this.height);
    for (const wall of this.map.createWalls(this.width, this.height)) {
      stampRect(this.staticMask, this.width, this.height, wall, 1);
    }
    this.dynamicWalls =
      this.map.createDynamicWalls?.(this.width, this.height, this.elapsedSec) ??
      [];
    this.stampMask();
  }

  private stampMask(): void {
    this.mask = this.staticMask.slice();
    for (const wall of this.dynamicWalls) {
      if (wall.solid) {
        stampRect(this.mask, this.width, this.height, wall, 1);
      }
    }
    this.maskDirty = true;
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
  }

  /** Puts each player's starting blob into a fresh state, at full energy. */
  private uploadSpawns(spawns: ColonySpawn[]): void {
    const resources = this.resources;
    if (resources == null) {
      return;
    }
    const gl = this.gl;
    const state = new Uint16Array(this.width * this.height * 4);
    const energy = Math.round(this.balance.maxEnergy * ENERGY_SCALE);
    const counts = spawns.map(() => 0);
    spawns.forEach((spawn, slot) => {
      for (const { x, y } of createBacteriaBlob(
        spawn.x,
        spawn.y,
        spawn.radius
      )) {
        if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
          continue;
        }
        const index = (y * this.width + x) * 4;
        if (state[index] !== 0) {
          continue;
        }
        state[index] = slot + 1;
        state[index + 1] = energy;
        counts[slot]++;
      }
    });
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
    // Reads of the last match that are still in flight finish, but count
    // for nothing.
    for (const readback of resources.pendingReadbacks) {
      readback.stale = true;
    }
    this.colonySummaries = spawns.map((spawn, slot) => ({
      playerId: spawn.playerId,
      color: spawn.color,
      count: counts[slot],
      captured: 0,
      lost: 0,
      totalEnergy: counts[slot] * this.balance.maxEnergy,
      center: counts[slot] > 0 ? { x: spawn.x, y: spawn.y } : null,
    }));
  }

  /** The box around a starting blob, before the first report is in. */
  private spawnBounds(slot: number): CellBounds | null {
    const spawn = this.spawns[slot];
    if (spawn == null) {
      return null;
    }
    const r = spawn.radius + 1;
    return {
      minX: clamp(Math.floor(spawn.x - r), 0, this.width - 1),
      minY: clamp(Math.floor(spawn.y - r), 0, this.height - 1),
      maxX: clamp(Math.ceil(spawn.x + r), 0, this.width - 1),
      maxY: clamp(Math.ceil(spawn.y + r), 0, this.height - 1),
    };
  }

  /**
   * Allocates every texture and buffer and sets the match's uniforms; the
   * programs are compiled once per context. Throws when the GPU cannot
   * render into one of the targets - then the CPU has to run the war.
   */
  private setup(): Resources {
    const gl = this.gl;
    const programs = compiledPrograms(gl);
    const { vao: quad, corners } = createQuad(gl);
    const state = () =>
      createTarget(gl, gl.RGBA16UI, this.width, this.height, gl.NEAREST);
    const layout = this.layout;
    const report = () =>
      createTarget(gl, gl.RGBA32UI, layout.width, layout.height, gl.NEAREST);
    const freeReadbacks: Readback[] = Array.from(
      { length: READBACK_SLOTS },
      () => {
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, buffer);
        gl.bufferData(
          gl.PIXEL_PACK_BUFFER,
          layout.width * layout.height * 16,
          gl.STREAM_READ
        );
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
        return { buffer, sync: null, generation: [], stale: false };
      }
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
      reports: [report(), report()],
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

/** Every target a frame renders into. */
function renderTargets(resources: Resources): Target[] {
  return [
    ...resources.states,
    resources.claims,
    resources.influence,
    resources.hunt,
    ...resources.reports,
  ];
}

/**
 * The compiled passes of each context. Every match gets a simulation of its
 * own, but compiling the shaders again each time would stall the start of
 * every match - so they are kept until the context is lost.
 */
const PROGRAMS = new WeakMap<WebGL2RenderingContext, Programs>();

function compiledPrograms(gl: WebGL2RenderingContext): Programs {
  const cached = PROGRAMS.get(gl);
  if (cached != null) {
    return cached;
  }
  const common = ['uState', 'uMask', 'uSize', 'uSeed'];
  const intents = [
    'uKind',
    'uStep',
    'uSteps[0]',
    'uTarget[0]',
    'uAggression[0]',
    'uJitter',
    'uCellSize',
    'uHunt',
    'uDivideThreshold',
    'uDivideChance',
    'uCanDivide[0]',
    'uParentShare',
  ];
  const pellets = ['uPellets[0]', 'uPelletCount', 'uPelletRadius'];
  const program = (fragment: string, uniforms: string[]) =>
    createProgram(gl, FULLSCREEN_VERTEX, fragment, [...common, ...uniforms]);
  const programs: Programs = {
    influence: program(INFLUENCE_FRAGMENT, ['uCellSize']),
    hunt: program(HUNT_FRAGMENT, ['uInfluence']),
    claim: program(CLAIM_FRAGMENT, intents),
    apply: program(APPLY_FRAGMENT, [...intents, 'uClaims']),
    crush: program(CRUSH_FRAGMENT, []),
    combat: program(COMBAT_FRAGMENT, [
      'uDt',
      'uAttack[0]',
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
    report: program(REPORT_FRAGMENT, [
      'uEvents',
      'uPrevious',
      'uCellSize',
      'uBlocks',
      ...pellets,
    ]),
  };
  PROGRAMS.set(gl, programs);
  return programs;
}
