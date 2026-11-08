import type { StateLayer } from '../arena/colony-renderer';
import {
  CellBounds,
  CellPasses,
  CellPassesHost,
  ColonySpawn,
  GameBalance,
  GridArena,
  GridFrame,
  GridTick,
  Point,
  INT_KIND,
  READBACK_SLOTS,
  readbacksToTake,
  Rect,
  ReportLayout,
  ReportSink,
} from '@wolsok/feat-shared-bacteria-engine';
import { activeRects, reachSinceReport } from './active-area';
import {
  bindTexture,
  sharedQuad,
  createTarget,
  createTexture,
  Program,
  Target,
} from './gl-utils';
import {
  compiledSharedPrograms,
  forgetPrograms,
  GpuRules,
  Programs,
  SetUniforms,
} from './gpu-rules';
import { HUNT_COLONIES } from './simulation-shaders';

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
  /** The context's quad, shared with the painter - see `sharedQuad`. */
  quad: WebGLVertexArrayObject;
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

/**
 * The cell passes of the colony war on the GPU - the rules of
 * `BacteriaSimulation` as WebGL2 shader passes over the arena grid, in the
 * same context the arena is painted with. The painter reads the state
 * straight from the texture, so no bacterium crosses to the CPU. Which
 * rules the passes compute by - the integer ones of ADR 0015 or the float
 * ones - is the {@link GpuRules} handed in; the walls, the gates and the
 * pellets stay on the CPU, in `GridWar`: they are a handful of rects and
 * points.
 *
 * A tick runs these passes:
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
 * or two frames old - or, by rules with a fixed `reportLag`, exactly that many ticks
 * old, waited for when the GPU is slow.
 */
export class GpuCellPasses implements CellPasses {
  public readonly kind = 'gpu';
  public readonly reportLag: number | null;
  /** Milliseconds the main thread waited for reports - see `takeGpuWaitMs`. */
  private gpuWaitMs = 0;
  private host: CellPassesHost | null = null;
  private width = 0;
  private height = 0;
  private layout: ReportLayout | null = null;
  private resources: Resources | null = null;
  /** The step of the tick that runs - see `pass`. */
  private step = 0;
  /** The state the next pass reads. */
  private current = 0;
  /** The state combat rendered into this frame. */
  private eventsIndex = 1;
  private reportIndex = 0;
  private effectsIndex = 0;
  /**
   * How many effects these passes last handed the programs, -1 before they
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
  /** The frame's length - for the glow's fading. */
  private frameDeltaSec = 0;

  public constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly balance: GameBalance,
    private readonly rules: GpuRules
  ) {
    this.reportLag = rules.reportLag;
    const canvas = gl.canvas;
    if (canvas instanceof HTMLCanvasElement) {
      canvas.addEventListener('webglcontextlost', this.onContextLost);
      canvas.addEventListener('webglcontextrestored', this.onContextRestored);
    }
  }

  /** The GPU forgot everything - nothing runs until it is back. */
  private readonly onContextLost = (): void => {
    forgetPrograms(this.gl);
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
    this.host?.restart();
  };

  public attach(host: CellPassesHost): void {
    this.host = host;
  }

  public colonyLayers(
    colonies: readonly ColonySpawn[],
    boosts: ReadonlyMap<number, Point>,
    boundsOf: (slot: number) => CellBounds | null
  ): StateLayer[] {
    const resources = this.resources;
    if (resources == null) {
      return [];
    }
    const state = resources.states[this.current].texture;
    const effects = resources.effects[this.effectsIndex].texture;
    return colonies.map((spawn, slot) => ({
      kind: 'state',
      color: spawn.color,
      boostTarget: boosts.get(spawn.playerId) ?? null,
      state,
      effects,
      owner: slot + 1,
      bounds: boundsOf(slot),
    }));
  }

  public ready(): boolean {
    return this.resources != null;
  }

  public allocate(arena: GridArena): void {
    this.width = arena.width;
    this.height = arena.height;
    this.layout = arena.layout;
    this.release();
    this.resources = this.setup();
  }

  public startMatch(): void {
    this.reportRendered = false;
    this.recentAreas.length = 0;
    this.recentReach.length = 0;
    this.uploadedEffects = -1;
  }

  public loadMask(mask: Uint8Array, hasHill: boolean): void {
    if (this.resources != null) {
      this.uploadMask(this.resources, mask, hasHill);
    }
  }

  public loadState(state: Uint16Array): void {
    const resources = this.resources;
    const layout = this.layout;
    if (resources == null || layout == null) {
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
    const zeros = new Uint32Array(layout.width * layout.height * 4);
    for (const report of resources.reports) {
      gl.bindTexture(gl.TEXTURE_2D, report.texture);
      gl.texSubImage2D(
        gl.TEXTURE_2D,
        0,
        0,
        0,
        layout.width,
        layout.height,
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

  public uploadFrame(frame: GridFrame): void {
    const programs = this.resources?.programs;
    if (programs == null) {
      return;
    }
    const gl = this.gl;
    this.frameDeltaSec = frame.deltaTimeSec;
    this.rules.uploadFrame(gl, programs, frame);
    // A plain match has no effects at all: the passes keep their count of
    // none from the last frame.
    const { effectCount, pelletCount } = frame;
    if (effectCount > 0 || this.uploadedEffects !== 0) {
      for (const program of [programs.claim, programs.apply, programs.combat]) {
        gl.useProgram(program.program);
        this.rules.uploadEffects(gl, program.uniforms, frame);
        gl.uniform1i(program.uniforms['uEffectCount'], effectCount);
      }
      this.uploadedEffects = effectCount;
    }
    for (const program of [programs.report, programs.effects]) {
      gl.useProgram(program.program);
      gl.uniform3fv(program.uniforms['uPellets[0]'], frame.uniforms.pellets);
      gl.uniform1i(program.uniforms['uPelletCount'], pelletCount);
    }
  }

  public collectReports(step: number, sink: ReportSink): void {
    if (this.resources != null) {
      this.collectReadbacks(this.resources, step, sink);
    }
  }

  public runTick(tick: GridTick, sink: ReportSink): void {
    const resources = this.resources;
    const layout = this.layout;
    if (resources == null || layout == null) {
      return;
    }
    const gl = this.gl;
    const { programs } = resources;
    this.step = tick.step;
    this.updateArea(tick);

    gl.disable(gl.BLEND);
    gl.disable(gl.SCISSOR_TEST);
    gl.bindVertexArray(resources.quad);
    bindTexture(gl, UNIT.mask, resources.mask, null);

    // 1. Who is where, coarsely - and where each colony hunts.
    gl.viewport(0, 0, layout.blocksX, layout.blocksY);
    this.pass(resources, programs.influence, resources.influence);
    bindTexture(gl, UNIT.influence, resources.influence.texture, null);
    gl.useProgram(programs.hunt.program);
    gl.uniform1i(programs.hunt.uniforms['uPair'], 0);
    this.pass(resources, programs.hunt, resources.hunt);
    if (tick.colonies > HUNT_COLONIES) {
      gl.uniform1i(programs.hunt.uniforms['uPair'], 1);
      this.pass(resources, programs.hunt, resources.huntMore);
    }
    bindTexture(gl, UNIT.hunt, resources.hunt.texture, null);
    bindTexture(gl, UNIT.huntMore, resources.huntMore.texture, null);

    gl.viewport(0, 0, this.width, this.height);
    // 2. Out of the way of a wall that moved - one cell per step, as far
    // as a wall may shove a bacterium - or crushed.
    for (let step = 0; step < tick.escapeSteps; step++) {
      this.claimAndApply(resources, INT_KIND.escape, step);
    }
    this.statePass(resources, programs.crush);

    // 3. Combat, nutrients and captures - kept as the frame's record.
    this.eventsIndex = this.current === 0 ? 1 : 0;
    this.statePass(resources, programs.combat, this.eventsIndex);
    this.statePass(resources, programs.feed);

    // 4. Division, 5. movement.
    this.claimAndApply(resources, INT_KIND.divide, 0);
    for (let step = 0; step < tick.mostSteps; step++) {
      this.claimAndApply(resources, INT_KIND.move, step);
    }
    this.renderEffects(resources, tick);

    // 6. The report. The one read back is last frame's, which the GPU has
    // finished by now - reading this frame's would make the driver wait.
    if (this.reportLag === null) {
      this.collectReadbacks(resources, tick.step, sink);
    }
    this.requestReadback(resources, tick.step);
    this.renderReport(resources, layout, tick.generation);

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

  public takeGpuWaitMs(): number {
    const waited = this.gpuWaitMs;
    this.gpuWaitMs = 0;
    return waited;
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
    // A read back may still be in flight, also one a new match marked stale
    // and freed unread: deleting its buffer under the GPU is what some
    // drivers get wrong, so the GPU finishes first - once, as the match ends.
    gl.finish();
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
   * Everything that stays the same for the whole match: the sizes, the
   * balance and which unit each sampler reads.
   */
  private setMatchUniforms(programs: Programs, layout: ReportLayout): void {
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
    this.rules.setMatchUniforms(programs, set);
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
      layout.blocksX,
      layout.blocksY
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
    gl.uniform1ui(program.uniforms['uSeed'], this.rules.seed(this.step));
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
   * area changes no bit of the war - the deterministic rules run on it too,
   * and play as the TypeScript reference, which runs the whole arena. A big
   * map, whose colonies hold a small share of it, runs a fraction of the
   * cells.
   */
  private updateArea(tick: GridTick): void {
    const reach = this.recentReach;
    reach.unshift(tick.mostSteps + 2 + tick.escapeSteps);
    reach.length = Math.min(reach.length, REACH_HISTORY);
    const whole = [{ x: 0, y: 0, width: this.width, height: this.height }];
    const report = tick.report;
    const margin =
      report == null || tick.escapeSteps > 0 || tick.step <= AREA_HISTORY
        ? null
        : reachSinceReport(reach, tick.step - tick.reportStep);
    const own =
      report == null || margin === null
        ? whole
        : activeRects(
            report.colonies.map((colony) => colony.bounds),
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
  private renderEffects(resources: Resources, tick: GridTick): void {
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
    const fade = (rate: number) => Math.exp(-rate * this.frameDeltaSec);
    gl.uniform3f(
      program.uniforms['uFade'],
      fade(EFFECT_FADE_PER_SEC.fight),
      fade(EFFECT_FADE_PER_SEC.eat),
      fade(EFFECT_FADE_PER_SEC.move)
    );
    // The first frame would find every starting bacterium freshly arrived.
    gl.uniform1i(program.uniforms['uTrack'], tick.step > 1 ? 1 : 0);
    this.pass(resources, program, resources.effects[this.effectsIndex]);
  }

  private renderReport(
    resources: Resources,
    layout: ReportLayout,
    generation: readonly number[]
  ): void {
    const gl = this.gl;
    const previous = resources.reports[this.reportIndex];
    this.reportIndex = 1 - this.reportIndex;
    gl.viewport(0, 0, layout.width, layout.height);
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
    this.renderedGeneration = generation.slice();
  }

  /**
   * Queues a read back of the last frame's report into a free buffer, if
   * there is one - and if a report was rendered at all since the match
   * started: the fresh one is all zeros, and no bacteria would read as a
   * draw.
   */
  private requestReadback(resources: Resources, step: number): void {
    const layout = this.layout;
    if (!this.reportRendered || layout == null) {
      return;
    }
    // Rules with a fixed lag need every report: they never run out of
    // buffers (see DETERMINISTIC_REPORT_LAG), but take another if they did.
    const readback =
      resources.freeReadbacks.pop() ??
      (this.reportLag === null ? undefined : createReadback(this.gl, layout));
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
      layout.width,
      layout.height,
      gl.RGBA_INTEGER,
      gl.UNSIGNED_INT,
      0
    );
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    readback.sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    // The report read is last frame's, so are the pellets it counted at.
    readback.generation = this.renderedGeneration;
    readback.step = step - 1;
    readback.stale = false;
    resources.pendingReadbacks.push(readback);
    gl.flush();
  }

  /**
   * Hands the read backs due to the sink, oldest first - see
   * `readbacksToTake`: every one the GPU has finished, or with a fixed
   * `reportLag` every one that many ticks old, finished or not. Reading an
   * unfinished one makes the driver wait for it.
   */
  private collectReadbacks(
    resources: Resources,
    step: number,
    sink: ReportSink
  ): void {
    const gl = this.gl;
    const data = resources.readbackData;
    const pending = resources.pendingReadbacks;
    const due = readbacksToTake(
      pending.map((readback) => ({
        step: readback.step,
        stale: readback.stale,
        ready: readback.sync == null || this.isFinished(readback.sync),
      })),
      step,
      this.reportLag
    );
    for (let taken = 0; taken < due; taken++) {
      const readback = pending[0];
      // One the GPU has not finished keeps the main thread waiting for it.
      const forced = readback.sync != null && !this.isFinished(readback.sync);
      if (readback.sync != null) {
        gl.deleteSync(readback.sync);
        readback.sync = null;
      }
      pending.shift();
      resources.freeReadbacks.push(readback);
      if (readback.stale) {
        continue;
      }
      const waitFrom = forced ? performance.now() : 0;
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, readback.buffer);
      gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, data);
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
      if (forced) {
        this.gpuWaitMs += performance.now() - waitFrom;
      }
      sink.take(data, readback.step, readback.generation);
    }
  }

  private isFinished(sync: WebGLSync): boolean {
    const status = this.gl.clientWaitSync(sync, 0, 0);
    return status !== this.gl.TIMEOUT_EXPIRED && status !== this.gl.WAIT_FAILED;
  }

  private uploadMask(
    resources: Resources,
    mask: Uint8Array,
    hasHill: boolean
  ): void {
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
      mask
    );
    // Only a map with a zone to hold has its bacteria on it counted.
    const report = resources.programs.report;
    gl.useProgram(report.program);
    gl.uniform1i(report.uniforms['uCountHill'], hasHill ? 1 : 0);
  }

  /**
   * Allocates every texture and buffer and sets the match's uniforms; the
   * programs are compiled once per context. Throws when the GPU cannot
   * render into one of the targets - then the CPU has to run the war.
   */
  private setup(): Resources {
    const gl = this.gl;
    const layout = this.layout;
    if (layout == null) {
      throw new Error('The GPU passes have no arena to set up for');
    }
    const programs: Programs = {
      ...compiledSharedPrograms(gl),
      ...this.rules.cellPrograms(gl),
    };
    const quad = sharedQuad(gl).vao;
    const state = () =>
      createTarget(gl, gl.RGBA16UI, this.width, this.height, gl.NEAREST);
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
    this.setMatchUniforms(programs, layout);
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
