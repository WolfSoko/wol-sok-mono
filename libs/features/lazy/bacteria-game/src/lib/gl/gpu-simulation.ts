import { CellBounds } from '../arena/arena-painter';
import {
  ColonySpawn,
  noEvents,
  Nutrient,
  StepEvents,
} from '../state/bacteria-simulation';
import { GameBalance } from '../state/game-balance';
import { Point } from '../state/geometry';
import { DynamicWall, GameMap, getMap, Rect } from '../state/maps';
import { NutrientPellets } from '../state/nutrient-pellets';
import {
  createBacteriaBlob,
  isBoosted,
  Player,
  PlayerColorArray,
} from '../state/player.model';
import { ColonySummary, Simulation } from '../state/simulation';
import {
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

/** Cells a colony may travel in the frames its last report is behind. */
const STALE_MARGIN = 12;

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
  generation: number[];
  /** Requested in an earlier match - read, so the buffer is free, but ignored. */
  stale: boolean;
}

interface Resources {
  programs: Programs;
  quad: WebGLVertexArrayObject;
  corners: WebGLBuffer;
  /** Ping and pong of the cell state. */
  states: [Target, Target];
  /** The state right after combat - the frame's record of who took whom. */
  events: Target;
  claims: Target;
  mask: WebGLTexture;
  influence: Target;
  hunt: Target;
  /** Ping and pong of the report, so the running totals can carry on. */
  reports: [Target, Target];
  readbacks: Readback[];
}

/** A colony slot of the GPU state. */
interface Slot {
  playerId: number;
  color: PlayerColorArray;
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
  private resources: Resources | null = null;
  private width = 0;
  private height = 0;
  private layout: ReportLayout;
  private map: GameMap = getMap('corridors');
  private elapsedSec = 0;
  private frame = 0;
  private current = 0;
  private reportIndex = 0;
  private slots: Slot[] = [];
  private spawns: ColonySpawn[] = [];
  private dynamicWalls: DynamicWall[] = [];
  private mask = new Uint8Array(0);
  private staticMask = new Uint8Array(0);
  private maskDirty = true;
  private escapePending = false;
  private readonly pellets: NutrientPellets;
  /** Bumped per pellet whenever it respawns, to drop stale eater counts. */
  private generation: number[] = [];
  private events: StepEvents = noEvents();
  private report: Report | null = null;
  private colonySummaries: ColonySummary[] = [];
  /** Totals of the last report, to turn them into this frame's events. */
  private reported = { captured: 0, lost: 0 };
  /** Seconds the pellets have not been drained for, waiting on a report. */
  private undrainedSec = 0;
  /** True once this match has rendered a report that can be read back. */
  private reportRendered = false;

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
    this.maskDirty = true;
    if (this.spawns.length > 0) {
      this.init(this.spawns);
    }
  };

  /** The cell state, for the painter. */
  public stateTexture(): WebGLTexture | null {
    return this.resources?.states[this.current].texture ?? null;
  }

  /** The state slot of a player's colony, null when it has none. */
  public slotOf(playerId: number): number | null {
    const slot = this.slots.findIndex((entry) => entry.playerId === playerId);
    return slot < 0 ? null : slot;
  }

  /**
   * The box around a colony, for the painter to scissor to. The report is a
   * frame or two old, so the box is grown by how far a boosted colony gets
   * in that time.
   */
  public boundsOf(slot: number): CellBounds | null {
    const bounds =
      this.report == null
        ? this.spawnBounds(slot)
        : (this.report.colonies[slot]?.bounds ?? null);
    if (bounds == null) {
      return null;
    }
    return {
      minX: Math.max(0, bounds.minX - STALE_MARGIN),
      minY: Math.max(0, bounds.minY - STALE_MARGIN),
      maxX: Math.min(this.width - 1, bounds.maxX + STALE_MARGIN),
      maxY: Math.min(this.height - 1, bounds.maxY + STALE_MARGIN),
    };
  }

  public setMap(map: GameMap): void {
    if (this.map === map) {
      return;
    }
    this.map = map;
    this.buildMask();
    this.resetPellets();
  }

  public resize(width: number, height: number): void {
    if (this.width === width && this.height === height) {
      return;
    }
    this.width = width;
    this.height = height;
    this.layout = reportLayout(width, height, this.balance.influenceCellSize);
    this.dispose();
    this.resources = this.setup();
    this.buildMask();
    this.resetPellets();
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
    this.slots = spawns.map(({ playerId, color }) => ({ playerId, color }));
    this.elapsedSec = 0;
    this.frame = 0;
    this.events = noEvents();
    this.report = null;
    this.reported = { captured: 0, lost: 0 };
    this.undrainedSec = 0;
    this.reportRendered = false;
    this.buildMask();
    this.resetPellets();
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
    if (resources == null || this.slots.length === 0 || deltaTimeSec <= 0) {
      return;
    }
    const gl = this.gl;
    this.elapsedSec += deltaTimeSec;
    this.frame++;
    this.advanceDynamicWalls();
    if (this.maskDirty) {
      this.uploadMask();
    }
    this.tickPellets(deltaTimeSec);

    gl.disable(gl.BLEND);
    gl.disable(gl.SCISSOR_TEST);
    gl.bindVertexArray(resources.quad);

    const targets = this.slots.map(
      (slot) => players.find((player) => player.id === slot.playerId) ?? null
    );

    // 1. Who is where, coarsely - and where each colony hunts.
    gl.viewport(0, 0, this.layout.blocksX, this.layout.blocksY);
    this.pass(resources.programs.influence, resources.influence, (u) => {
      gl.uniform1i(u['uCellSize'], this.balance.influenceCellSize);
    });
    this.pass(resources.programs.hunt, resources.hunt, (u) => {
      this.bindTexture(0, resources.influence.texture, u['uInfluence']);
    });

    gl.viewport(0, 0, this.width, this.height);
    // 2. Out of the way of a wall that moved, or crushed.
    if (this.escapePending) {
      for (let step = 0; step < ESCAPE_STEPS; step++) {
        this.claimAndApply(KIND.escape, step, targets, deltaTimeSec);
      }
      this.escapePending = false;
    }
    this.statePass(resources.programs.crush, () => undefined);

    // 3. Combat, nutrients and captures - kept as the frame's record.
    this.statePass(
      resources.programs.combat,
      (u) => this.combatUniforms(u, targets, deltaTimeSec),
      resources.events
    );
    this.statePass(resources.programs.feed, (u) => {
      gl.uniform1f(u['uFeed'], this.balance.feedEnergyPerCapture);
    });

    // 4. Division, 5. movement.
    this.claimAndApply(KIND.divide, 0, targets, deltaTimeSec);
    const steps = this.moveSteps(targets, deltaTimeSec);
    const mostSteps = Math.max(...steps);
    for (let step = 0; step < mostSteps; step++) {
      this.claimAndApply(KIND.move, step, targets, deltaTimeSec);
    }

    // 6. The report. The one read back is last frame's, which the GPU has
    // finished by now - reading this frame's would make the driver wait.
    this.collectReadbacks();
    this.requestReadback();
    this.renderReport();

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindVertexArray(null);
  }

  public dispose(): void {
    const gl = this.gl;
    const canvas = gl.canvas;
    if (canvas instanceof HTMLCanvasElement) {
      canvas.removeEventListener('webglcontextlost', this.onContextLost);
      canvas.removeEventListener(
        'webglcontextrestored',
        this.onContextRestored
      );
    }
    const resources = this.resources;
    this.resources = null;
    if (resources == null) {
      return;
    }
    const targets = [
      ...resources.states,
      resources.events,
      resources.claims,
      resources.influence,
      resources.hunt,
      ...resources.reports,
    ];
    for (const target of targets) {
      gl.deleteFramebuffer(target.framebuffer);
      gl.deleteTexture(target.texture);
    }
    gl.deleteTexture(resources.mask);
    gl.deleteVertexArray(resources.quad);
    gl.deleteBuffer(resources.corners);
    for (const readback of resources.readbacks) {
      gl.deleteBuffer(readback.buffer);
      if (readback.sync != null) {
        gl.deleteSync(readback.sync);
      }
    }
  }

  /** One claim and apply pair - a step of moving, escaping or dividing. */
  private claimAndApply(
    kind: number,
    step: number,
    targets: (Player | null)[],
    deltaTimeSec: number
  ): void {
    const resources = this.resources;
    if (resources == null) {
      return;
    }
    const gl = this.gl;
    const setIntents = (u: Program['uniforms']) =>
      this.intentUniforms(u, kind, step, targets, deltaTimeSec);

    const claim = resources.programs.claim;
    gl.useProgram(claim.program);
    this.stateUniforms(claim.uniforms);
    setIntents(claim.uniforms);
    gl.bindFramebuffer(gl.FRAMEBUFFER, resources.claims.framebuffer);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    this.statePass(resources.programs.apply, (u) => {
      setIntents(u);
      this.bindTexture(2, resources.claims.texture, u['uClaims']);
    });
  }

  /** A full grid pass from the current state into the other one. */
  private statePass(
    program: Program,
    setUniforms: (uniforms: Program['uniforms']) => void,
    into?: Target
  ): void {
    const resources = this.resources;
    if (resources == null) {
      return;
    }
    const gl = this.gl;
    const next = 1 - this.current;
    const target = into ?? resources.states[next];
    gl.useProgram(program.program);
    this.stateUniforms(program.uniforms);
    setUniforms(program.uniforms);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    if (into == null) {
      this.current = next;
    } else {
      // The record becomes the state the next pass reads: copy it over.
      this.copyInto(into, resources.states[next]);
      this.current = next;
    }
  }

  /** Copies one state texture into another, both the size of the arena. */
  private copyInto(from: Target, to: Target): void {
    const gl = this.gl;
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, from.framebuffer);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, to.framebuffer);
    gl.blitFramebuffer(
      0,
      0,
      this.width,
      this.height,
      0,
      0,
      this.width,
      this.height,
      gl.COLOR_BUFFER_BIT,
      gl.NEAREST
    );
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
  }

  /** A pass that does not read the state into a target of its own. */
  private pass(
    program: Program,
    target: Target,
    setUniforms: (uniforms: Program['uniforms']) => void
  ): void {
    const gl = this.gl;
    gl.useProgram(program.program);
    this.stateUniforms(program.uniforms);
    setUniforms(program.uniforms);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  /** The state, the walls, the arena size and the frame's random seed. */
  private stateUniforms(u: Program['uniforms']): void {
    const resources = this.resources;
    if (resources == null) {
      return;
    }
    const gl = this.gl;
    this.bindTexture(0, resources.states[this.current].texture, u['uState']);
    this.bindTexture(1, resources.mask, u['uMask']);
    gl.uniform2i(u['uSize'], this.width, this.height);
    gl.uniform1ui(u['uSeed'], (this.frame * 2654435761) >>> 0);
  }

  private intentUniforms(
    u: Program['uniforms'],
    kind: number,
    step: number,
    targets: (Player | null)[],
    deltaTimeSec: number
  ): void {
    const gl = this.gl;
    const resources = this.resources;
    if (resources == null) {
      return;
    }
    const b = this.balance;
    gl.uniform1i(u['uKind'], kind);
    gl.uniform1i(u['uStep'], step);
    gl.uniform1iv(u['uSteps[0]'], this.moveSteps(targets, deltaTimeSec));
    gl.uniform2fv(
      u['uTarget[0]'],
      padded(
        targets.flatMap((target) =>
          target == null || isNaN(target.x) || isNaN(target.y)
            ? [NaN, NaN]
            : [target.x, target.y]
        ),
        MAX_GPU_COLONIES * 2
      )
    );
    gl.uniform1fv(
      u['uAggression[0]'],
      padded(
        targets.map((target) =>
          isBoosted(target) ? b.boostAggression : b.aggression
        ),
        MAX_GPU_COLONIES
      )
    );
    gl.uniform1f(u['uJitter'], b.jitter);
    gl.uniform1i(u['uCellSize'], b.influenceCellSize);
    this.bindTexture(3, resources.hunt.texture, u['uHunt']);
    gl.uniform1f(u['uDivideThreshold'], b.divideEnergyThreshold);
    gl.uniform1f(u['uDivideChance'], b.divideChancePerSec * deltaTimeSec);
    gl.uniform1iv(u['uCanDivide[0]'], this.divisionAllowed());
    gl.uniform1f(u['uParentShare'], b.parentEnergyShare);
  }

  private combatUniforms(
    u: Program['uniforms'],
    targets: (Player | null)[],
    deltaTimeSec: number
  ): void {
    const gl = this.gl;
    const b = this.balance;
    gl.uniform1f(u['uDt'], deltaTimeSec);
    gl.uniform1fv(
      u['uAttack[0]'],
      padded(
        targets.map((target) => (isBoosted(target) ? b.boostAttackFactor : 1)),
        MAX_GPU_COLONIES
      )
    );
    this.pelletUniforms(u);
    gl.uniform1f(u['uNutrientGain'], b.nutrientDrainPerSec * deltaTimeSec);
    gl.uniform1f(u['uDefenceFactor'], b.defenceFactor);
    gl.uniform1f(u['uFrontlinePressure'], b.frontlinePressure);
    gl.uniform1f(u['uCombatDrain'], b.combatDrainPerSec);
    gl.uniform1f(u['uRegen'], b.energyRegenPerSec);
    gl.uniform1f(u['uOverchargeDecay'], b.overchargeDecayPerSec);
    gl.uniform1f(u['uMaxEnergy'], b.maxEnergy);
    gl.uniform1f(u['uSuperMaxEnergy'], b.superChargedMaxEnergy);
    gl.uniform1f(u['uConsumeChance'], b.consumeChance);
    gl.uniform1f(u['uCaptureEnergy'], b.captureEnergy);
  }

  private pelletUniforms(u: Program['uniforms']): void {
    const gl = this.gl;
    const nutrients = this.pellets.nutrients.slice(0, MAX_PELLETS);
    gl.uniform3fv(
      u['uPellets[0]'],
      padded(
        nutrients.flatMap((pellet) => [
          pellet.x,
          pellet.y,
          pellet.amount > 0 ? 1 : 0,
        ]),
        MAX_PELLETS * 3
      )
    );
    gl.uniform1i(u['uPelletCount'], nutrients.length);
    gl.uniform1i(u['uPelletRadius'], this.balance.nutrientRadius);
  }

  /** Cells each colony travels this frame - a boosted one goes further. */
  private moveSteps(
    targets: (Player | null)[],
    deltaTimeSec: number
  ): number[] {
    return padded(
      targets.map((target) => {
        if (target == null || isNaN(target.x) || isNaN(target.y)) {
          return 0;
        }
        const speed = isBoosted(target)
          ? target.maxSpeed * this.balance.boostSpeedFactor
          : target.maxSpeed;
        return Math.min(
          MAX_MOVE_STEPS,
          Math.max(1, Math.round(speed * deltaTimeSec))
        );
      }),
      MAX_GPU_COLONIES
    );
  }

  /**
   * Whether each colony may still divide: below its share of the arena's
   * carrying capacity, as of the last report.
   */
  private divisionAllowed(): number[] {
    const { maxBacteriaPerPlayer, maxTotalBacteria } = this.balance;
    const capacity = Math.max(
      1,
      Math.min(
        maxBacteriaPerPlayer,
        Math.floor(maxTotalBacteria / Math.max(1, this.slots.length))
      )
    );
    return padded(
      this.slots.map((_, slot) =>
        (this.colonySummaries[slot]?.count ?? 0) < capacity ? 1 : 0
      ),
      MAX_GPU_COLONIES
    );
  }

  private renderReport(): void {
    const resources = this.resources;
    if (resources == null) {
      return;
    }
    const gl = this.gl;
    const previous = resources.reports[this.reportIndex];
    this.reportIndex = 1 - this.reportIndex;
    const target = resources.reports[this.reportIndex];
    const program = resources.programs.report;
    gl.viewport(0, 0, this.layout.width, this.layout.height);
    this.reportRendered = true;
    this.pass(program, target, (u) => {
      this.bindTexture(2, resources.events.texture, u['uEvents']);
      this.bindTexture(3, previous.texture, u['uPrevious']);
      gl.uniform1i(u['uCellSize'], this.balance.influenceCellSize);
      gl.uniform2i(u['uBlocks'], this.layout.blocksX, this.layout.blocksY);
      this.pelletUniforms(u);
    });
    gl.viewport(0, 0, this.width, this.height);
  }

  /**
   * Queues a read back of the last frame's report into a free buffer, if
   * there is one - and if a report was rendered at all since the match
   * started: the fresh one is all zeros, and no bacteria would read as a
   * draw.
   */
  private requestReadback(): void {
    const resources = this.resources;
    if (resources == null || !this.reportRendered) {
      return;
    }
    const readback = resources.readbacks.find((entry) => entry.sync == null);
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
    readback.generation = [...this.generation];
    readback.stale = false;
    gl.flush();
  }

  /** Takes in every read back the GPU has finished, oldest first. */
  private collectReadbacks(): void {
    const resources = this.resources;
    if (resources == null) {
      return;
    }
    const gl = this.gl;
    const data = new Uint32Array(this.layout.width * this.layout.height * 4);
    for (const readback of resources.readbacks) {
      if (readback.sync == null) {
        continue;
      }
      const status = gl.clientWaitSync(readback.sync, 0, 0);
      if (status === gl.TIMEOUT_EXPIRED || status === gl.WAIT_FAILED) {
        continue;
      }
      gl.deleteSync(readback.sync);
      readback.sync = null;
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, readback.buffer);
      gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, data);
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
      if (readback.stale) {
        readback.stale = false;
        continue;
      }
      this.takeReport(decodeReport(data, this.layout), readback.generation);
    }
  }

  /** Turns a report into the scoreboard, the frame's events and the eaters. */
  private takeReport(report: Report, generation: number[]): void {
    this.report = report;
    this.colonySummaries = this.slots.map((slot, index) => {
      const colony = report.colonies[index];
      return {
        playerId: slot.playerId,
        color: slot.color,
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
      if (generation[n] !== this.generation[n]) {
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
      if (nutrient.amount > 0) {
        return;
      }
      const before = this.pellets.nutrients.map((pellet) => pellet);
      this.pellets.tickEmpty(
        n,
        deltaTimeSec,
        this.width,
        this.height,
        this.isOpenCell
      );
      this.pellets.nutrients.forEach((pellet, m) => {
        if (pellet !== before[m]) {
          this.generation[m] = (this.generation[m] ?? 0) + 1;
        }
      });
    });
  }

  private resetPellets(): void {
    this.pellets.reset(this.width, this.height, this.isOpenCell);
    this.generation = this.pellets.nutrients.map(
      (_, n) => (this.generation[n] ?? 0) + 1
    );
  }

  private readonly isOpenCell = (x: number, y: number): boolean =>
    this.mask[y * this.width + x] === 0;

  /** Moves the gates and sliding walls on and notes what they did. */
  private advanceDynamicWalls(): void {
    if (this.map.createDynamicWalls == null) {
      return;
    }
    const previous = this.dynamicWalls;
    const next = this.map.createDynamicWalls(
      this.width,
      this.height,
      this.elapsedSec
    );
    this.dynamicWalls = next;
    let changed = next.length !== previous.length;
    next.forEach((after, i) => {
      const before = previous[i];
      if (before == null) {
        return;
      }
      if (after.solid && !before.solid) {
        this.events.gatesClosed++;
      }
      if (after.warning > 0 && before.warning === 0) {
        this.events.gatesWarned++;
      }
      changed ||=
        after.solid !== before.solid ||
        after.x !== before.x ||
        after.y !== before.y ||
        after.width !== before.width ||
        after.height !== before.height;
    });
    if (changed) {
      this.stampMask();
      this.escapePending = true;
    }
  }

  /** The static walls, and the moving ones as of the match time. */
  private buildMask(): void {
    const cells = this.width * this.height;
    this.staticMask = new Uint8Array(cells);
    for (const wall of this.map.createWalls(this.width, this.height)) {
      stamp(this.staticMask, this.width, this.height, wall);
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
        stamp(this.mask, this.width, this.height, wall);
      }
    }
    this.maskDirty = true;
  }

  private uploadMask(): void {
    const resources = this.resources;
    if (resources == null) {
      return;
    }
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
    for (const readback of resources.readbacks) {
      readback.stale = readback.sync != null;
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
      minX: Math.max(0, Math.floor(spawn.x - r)),
      minY: Math.max(0, Math.floor(spawn.y - r)),
      maxX: Math.min(this.width - 1, Math.ceil(spawn.x + r)),
      maxY: Math.min(this.height - 1, Math.ceil(spawn.y + r)),
    };
  }

  private bindTexture(
    unit: number,
    texture: WebGLTexture,
    location: WebGLUniformLocation | null | undefined
  ): void {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(location ?? null, unit);
  }

  /** Allocates every texture and buffer; the programs are compiled once. */
  private setup(): Resources {
    const gl = this.gl;
    const programs = compiledPrograms(gl);
    const { vao: quad, corners } = createQuad(gl);
    const state = () =>
      createTarget(gl, gl.RGBA16UI, this.width, this.height, gl.NEAREST);
    const layout = this.layout;
    const report = () =>
      createTarget(gl, gl.RGBA32UI, layout.width, layout.height, gl.NEAREST);
    const readbacks: Readback[] = Array.from({ length: READBACK_SLOTS }, () => {
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, buffer);
      gl.bufferData(
        gl.PIXEL_PACK_BUFFER,
        layout.width * layout.height * 16,
        gl.STREAM_READ
      );
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
      return { buffer, sync: null, generation: [], stale: false };
    });

    return {
      programs,
      quad,
      corners,
      states: [state(), state()],
      events: state(),
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
      readbacks,
    };
  }
}

/** The values, filled up with zeros to the length a uniform array has. */
function padded(values: number[], length: number): number[] {
  return [
    ...values,
    ...new Array(Math.max(0, length - values.length)).fill(0),
  ].slice(0, length);
}

/** Marks the cells a rect covers in a mask. */
function stamp(
  mask: Uint8Array,
  width: number,
  height: number,
  rect: Rect
): void {
  const xMax = Math.min(rect.x + rect.width, width);
  const yMax = Math.min(rect.y + rect.height, height);
  for (let y = Math.max(rect.y, 0); y < yMax; y++) {
    for (let x = Math.max(rect.x, 0); x < xMax; x++) {
      mask[y * width + x] = 1;
    }
  }
}

/**
 * The compiled passes of each context. Every match gets a simulation of its
 * own, but compiling the shaders again each time would stall the start of
 * every match - so they are kept as long as the context lives.
 */
const PROGRAMS = new WeakMap<WebGL2RenderingContext, Programs>();

function compiledPrograms(gl: WebGL2RenderingContext): Programs {
  const cached = PROGRAMS.get(gl);
  if (cached != null && !gl.isContextLost()) {
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
