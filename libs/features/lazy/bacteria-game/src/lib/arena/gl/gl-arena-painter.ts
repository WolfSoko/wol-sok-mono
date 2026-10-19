import { scaleOf } from '../../state/arena-size';
import { GameBalance } from '../../state/game-balance';
import { Bacteria } from '../../state/player.model';
import { CellBounds, emptyBounds, growBounds } from '../../state/geometry';
import { ArenaFrame, ArenaPainter } from '../arena-painter';
import { paintArenaBackground } from '../arena-renderer';
import { ArenaTheme } from '../arena-theme';
import {
  cellDensity,
  ColonyLayer,
  jamDrops,
  overcharge,
  StateLayer,
  strengthOf,
} from '../colony-renderer';
import { CELLS_FRAGMENT, MAX_GPU_COLONIES } from '../../gl/simulation-shaders';
import { GpuSimulation } from '../../gl/gpu-simulation';
import { Motes } from '../motes';
import {
  bindTexture,
  createProgram,
  createQuad,
  createTarget,
  createTexture,
  FULLSCREEN_VERTEX,
  Program,
  Target,
} from '../../gl/gl-utils';
import {
  BLIT_FRAGMENT,
  BLUR_FRAGMENT,
  COLONY_FRAGMENT,
  EFFECTS_FRAGMENT,
  FLOOR_FRAGMENT,
  SHAPE_FRAGMENT,
  SHAPE_VERTEX,
} from './shaders';
import {
  pushBackground,
  pushForeground,
  SHAPE_STRIDE,
  ShapeBatch,
} from './shape-batch';

/**
 * Packs a colony into the cells texture, two bytes per arena cell: its
 * density - 0 for an empty cell, from 0.55 up for a bacterium, by its
 * strength - and its overcharge. This is all the CPU does for a colony; the
 * blur, the outline, the gloss and the shimmer run on the GPU.
 *
 * Returns the cells the colony covers, null for a colony without bacteria.
 */
export function encodeCells(
  out: Uint8Array,
  width: number,
  bacterias: readonly Bacteria[],
  balance: GameBalance
): CellBounds | null {
  out.fill(0);
  if (bacterias.length === 0) {
    return null;
  }
  const bounds = emptyBounds();
  for (const { x, y, energy } of bacterias) {
    const index = (y * width + x) * 2;
    out[index] = Math.round(255 * cellDensity(strengthOf(energy, balance)));
    out[index + 1] = Math.round(255 * overcharge(energy, balance));
    growBounds(bounds, x, y);
  }
  return bounds;
}

/**
 * How far beyond its cells each pass of a colony runs. The colony is drawn
 * 3 cells out - the blur spreads it by two, the slope of the slime reads one
 * more. Each pass reads past its own box, so the one before it has to cover
 * that too: the slime reads the vertical blur 1 cell further out, the
 * vertical blur reads the horizontal one 2 rows further out. A pass that
 * read past what was blurred this frame would pick up stale density - the
 * other colony's, where the two meet.
 */
const MARGIN = {
  colony: 3,
  verticalBlur: 4,
  horizontalBlur: 6,
  /** The glow's halo reaches three cells out. */
  effects: 4,
  /** The horizontal blur reads the cells 2 columns beyond its box. */
  cells: 8,
} as const;

interface Programs {
  floor: Program;
  blit: Program;
  blur: Program;
  colony: Program;
  shape: Program;
  /** A GPU colony's cells out of the simulation's state. */
  cells: Program;
  /** The glow of fights, meals and pushes. */
  effects: Program;
}

interface Resources {
  programs: Programs;
  quad: WebGLVertexArrayObject;
  shapes: WebGLVertexArrayObject;
  instances: WebGLBuffer;
  floor: WebGLTexture;
  /** One colony's cells - uploaded from the CPU, or drawn from the GPU state. */
  cells: Target;
  /** The two halves of the separable blur. */
  blur: [Target, Target];
  /** The frame being built - it survives into the next, for the trail. */
  trail: Target;
}

/**
 * The arena drawn on the GPU with WebGL2: the floor and the fading trail,
 * the colonies in either look, the walls and gates, the jam and the
 * crosshairs. Per frame the CPU only packs each colony's cells into a small
 * texture and the shapes into one instance buffer.
 *
 * The frame is built in an offscreen texture that is kept between frames -
 * laying the floor over it at partial opacity is what leaves the trail -
 * and copied onto the canvas at the end. The drawing buffer is preserved,
 * so the vaporize effect can still read the arena off the canvas.
 *
 * A lost context (the GPU was reset, or the phone reclaimed it) is rebuilt
 * once the browser restores it; nothing is drawn in between.
 */
export class GlArenaPainter implements ArenaPainter {
  public readonly kind = 'webgl';
  private resources: Resources | null = null;
  /** True once the context was handed back - it is not built again then. */
  private disposed = false;
  private theme: ArenaTheme | null = null;
  private readonly motes: Motes;
  private readonly background = new ShapeBatch();
  private readonly foreground = new ShapeBatch();
  private readonly cellBytes: Uint8Array;
  private readonly canvasWidth: number;
  private readonly canvasHeight: number;
  /** Cells per base cell - the jam and the crosshairs are as big on every grid. */
  private readonly unit: number;

  /** A painter for the canvas, or null where WebGL2 is not available. */
  public static create(
    canvas: HTMLCanvasElement,
    width: number,
    height: number
  ): GlArenaPainter | null {
    let gl: WebGL2RenderingContext | null = null;
    try {
      gl = canvas.getContext('webgl2', {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        premultipliedAlpha: false,
        // Keeping the drawing buffer costs a copy of the canvas every frame
        // on many GPUs - a snapshot asks for `showLastFrame` instead.
        preserveDrawingBuffer: false,
      });
    } catch {
      return null;
    }
    return gl == null ? null : new GlArenaPainter(canvas, gl, width, height);
  }

  private constructor(
    canvas: HTMLCanvasElement,
    private readonly gl: WebGL2RenderingContext,
    private readonly width: number,
    private readonly height: number
  ) {
    // Sized by `createArenaPainter`.
    this.canvasWidth = canvas.width;
    this.canvasHeight = canvas.height;
    this.unit = scaleOf(width);
    this.motes = new Motes(width, height);
    this.cellBytes = new Uint8Array(width * height * 2);
    this.resources = this.setup();

    canvas.addEventListener('webglcontextlost', (event) => {
      if (this.disposed) {
        return;
      }
      // Without this the browser would never hand the context back.
      event.preventDefault();
      this.resources = null;
    });
    canvas.addEventListener('webglcontextrestored', () => {
      if (this.disposed) {
        return;
      }
      this.resources = this.setup();
      if (this.theme != null) {
        this.uploadFloor(this.theme);
      }
    });
  }

  /** Each colony's colour for the glow, filled per frame. */
  private readonly effectColors = new Float32Array(MAX_GPU_COLONIES * 3);

  /**
   * A simulation that runs the war on this painter's GPU context - its
   * state is then drawn without leaving the GPU.
   */
  public createSimulation(
    balance: GameBalance,
    random: () => number
  ): GpuSimulation {
    return new GpuSimulation(this.gl, balance, random);
  }

  /**
   * Hands the context back to the browser right away rather than once the
   * canvas is collected - a page may only hold a few WebGL contexts.
   */
  public dispose(): void {
    this.disposed = true;
    this.resources = null;
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
  }

  public setTheme(theme: ArenaTheme): void {
    if (this.theme === theme) {
      return;
    }
    this.theme = theme;
    this.motes.reset(theme);
    this.uploadFloor(theme);
  }

  public paint(frame: ArenaFrame): void {
    const gl = this.gl;
    const resources = this.resources;
    const theme = this.theme;
    if (resources == null || theme == null) {
      return;
    }
    const { programs } = resources;
    this.motes.advance(frame.deltaTimeSec);

    gl.bindFramebuffer(gl.FRAMEBUFFER, resources.trail.framebuffer);
    gl.viewport(0, 0, this.canvasWidth, this.canvasHeight);
    gl.enable(gl.BLEND);
    this.useAlphaBlend();

    // Lay the floor over the previous frame, so movement leaves a short trail.
    this.useFullscreen(programs.floor);
    bindTexture(gl, 0, resources.floor, programs.floor.uniforms['uFloor']);
    gl.uniform2f(programs.floor.uniforms['uArena'], this.width, this.height);
    gl.uniform1f(programs.floor.uniforms['uAlpha'], frame.clear ? 1 : 0.7);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    this.background.clear();
    pushBackground(
      this.background,
      theme,
      this.motes,
      frame.walls,
      frame.dynamicWalls
    );
    this.drawShapes(this.background);

    for (const colony of frame.colonies) {
      this.drawColony(frame, colony);
    }
    if (!frame.reducedMotion) {
      this.drawEffects(frame);
    }

    this.foreground.clear();
    pushForeground(
      this.foreground,
      jamDrops(
        frame.nutrients,
        frame.balance.nutrientEnergy,
        frame.timeSec,
        this.unit
      ),
      frame.cursors,
      this.unit
    );
    this.drawShapes(this.foreground);
    this.showLastFrame();
  }

  /** Copies the frame, kept in the trail, onto the canvas. */
  public showLastFrame(): void {
    const gl = this.gl;
    const resources = this.resources;
    if (resources == null) {
      return;
    }
    const { programs } = resources;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvasWidth, this.canvasHeight);
    gl.disable(gl.BLEND);
    this.useFullscreen(programs.blit);
    bindTexture(
      gl,
      0,
      resources.trail.texture,
      programs.blit.uniforms['uImage']
    );
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  /**
   * One colony: its cells - uploaded from the CPU, or drawn straight from the
   * GPU simulation's state - are blurred on the arena grid for the slime
   * look, and drawn over the frame in a single pass.
   */
  private drawColony(frame: ArenaFrame, layer: ColonyLayer): void {
    const gl = this.gl;
    const resources = this.resources;
    if (resources == null) {
      return;
    }
    const { programs, blur, cells } = resources;
    const { color, boostTarget } = layer;
    const bounds =
      layer.kind === 'cells'
        ? this.uploadCells(layer.bacterias, frame.balance)
        : layer.bounds;
    if (bounds == null) {
      return;
    }
    // Only the box around the colony is blurred and drawn - the rest of the
    // arena would be fragments the GPU works on to discard them.
    gl.enable(gl.SCISSOR_TEST);
    if (layer.kind === 'state') {
      this.drawCellsFromState(layer, bounds, frame.balance);
    }

    const slime = frame.look === 'slime';
    if (slime) {
      gl.disable(gl.BLEND);
      gl.viewport(0, 0, this.width, this.height);
      this.useFullscreen(programs.blur);
      this.scissorCells(bounds, MARGIN.horizontalBlur);
      this.blurPass(cells.texture, blur[0], 1, 0);
      this.scissorCells(bounds, MARGIN.verticalBlur);
      this.blurPass(blur[0].texture, blur[1], 0, 1);
      gl.bindFramebuffer(gl.FRAMEBUFFER, resources.trail.framebuffer);
      gl.viewport(0, 0, this.canvasWidth, this.canvasHeight);
      gl.enable(gl.BLEND);
    }

    this.scissorCanvas(bounds, MARGIN.colony);
    const program = programs.colony;
    this.useFullscreen(program);
    bindTexture(gl, 0, blur[1].texture, program.uniforms['uDensity']);
    bindTexture(gl, 1, cells.texture, program.uniforms['uCells']);
    gl.uniform2f(program.uniforms['uArena'], this.width, this.height);
    gl.uniform3f(
      program.uniforms['uColor'],
      color[0] / 255,
      color[1] / 255,
      color[2] / 255
    );
    gl.uniform1f(program.uniforms['uAlpha'], (color[3] ?? 255) / 255);
    gl.uniform1i(program.uniforms['uLook'], slime ? 0 : 1);
    gl.uniform1f(
      program.uniforms['uShimmer'],
      boostTarget == null ? -1 : frame.timeSec
    );
    if (boostTarget != null) {
      gl.uniform2f(
        program.uniforms['uBoostTarget'],
        boostTarget.x,
        boostTarget.y
      );
      gl.uniform1f(program.uniforms['uUnit'], this.unit);
    }
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.disable(gl.SCISSOR_TEST);
  }

  /** The colony's cells grown by a margin, clamped to the arena. */
  private box(bounds: CellBounds, margin: number): number[] {
    return [
      Math.max(0, bounds.minX - margin),
      Math.max(0, bounds.minY - margin),
      Math.min(this.width, bounds.maxX + 1 + margin),
      Math.min(this.height, bounds.maxY + 1 + margin),
    ];
  }

  /** Scissors a pass on the canvas, whose row 0 is the bottom of the arena. */
  private scissorCanvas(bounds: CellBounds, margin: number): void {
    const [x0, y0, x1, y1] = this.box(bounds, margin);
    const scale = this.canvasWidth / this.width;
    // Out to whole pixels - at a scale like 7.5 a cell edge falls inside one.
    const left = Math.floor(x0 * scale);
    const bottom = Math.floor(this.canvasHeight - y1 * scale);
    this.gl.scissor(
      left,
      bottom,
      Math.ceil(x1 * scale) - left,
      Math.ceil(this.canvasHeight - y0 * scale) - bottom
    );
  }

  /** Scissors a pass on the arena grid - its row y is arena row y. */
  private scissorCells(bounds: CellBounds, margin: number): void {
    const [x0, y0, x1, y1] = this.box(bounds, margin);
    this.gl.scissor(x0, y0, x1 - x0, y1 - y0);
  }

  /** Packs a CPU colony into the cells texture and uploads it. */
  private uploadCells(
    bacterias: readonly Bacteria[],
    balance: GameBalance
  ): CellBounds | null {
    const gl = this.gl;
    const cells = this.resources?.cells;
    const bounds = encodeCells(this.cellBytes, this.width, bacterias, balance);
    if (cells == null || bounds == null) {
      return bounds;
    }
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, cells.texture);
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      0,
      0,
      this.width,
      this.height,
      gl.RG,
      gl.UNSIGNED_BYTE,
      this.cellBytes
    );
    return bounds;
  }

  /**
   * Draws a GPU colony's cells out of the simulation's state into the cells
   * texture - nothing crosses to the CPU. Only the box the blur reads is
   * drawn, all of it: cells of other colonies come out empty, so nothing
   * of them is left in there.
   */
  private drawCellsFromState(
    colony: StateLayer,
    bounds: CellBounds,
    balance: GameBalance
  ): void {
    const gl = this.gl;
    const resources = this.resources;
    if (resources == null) {
      return;
    }
    const program = resources.programs.cells;
    gl.disable(gl.BLEND);
    gl.viewport(0, 0, this.width, this.height);
    gl.bindFramebuffer(gl.FRAMEBUFFER, resources.cells.framebuffer);
    this.scissorCells(bounds, MARGIN.cells);
    this.useFullscreen(program);
    bindTexture(gl, 0, colony.state, program.uniforms['uState']);
    gl.uniform1ui(program.uniforms['uOwner'], colony.owner);
    gl.uniform1f(program.uniforms['uMaxEnergy'], balance.maxEnergy);
    gl.uniform1f(
      program.uniforms['uSuperMaxEnergy'],
      balance.superChargedMaxEnergy
    );
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, resources.trail.framebuffer);
    gl.viewport(0, 0, this.canvasWidth, this.canvasHeight);
    gl.enable(gl.BLEND);
  }

  /** Adds the glow of what the colonies do over them, light on light. */
  private drawEffects(frame: ArenaFrame): void {
    const gl = this.gl;
    const program = this.resources?.programs.effects;
    if (program == null) {
      return;
    }
    // Only around the colonies can anything glow - the box around all of
    // them spares the GPU the rest of the canvas.
    const colors = this.effectColors.fill(0);
    const around = emptyBounds();
    let effects: WebGLTexture | null = null;
    for (const layer of frame.colonies) {
      if (layer.kind !== 'state' || layer.bounds == null) {
        continue;
      }
      effects = layer.effects;
      colors.set(layer.color.slice(0, 3), (layer.owner - 1) * 3);
      const { minX, minY, maxX, maxY } = layer.bounds;
      growBounds(around, minX, minY, maxX, maxY);
    }
    if (effects == null) {
      return;
    }
    gl.enable(gl.SCISSOR_TEST);
    this.scissorCanvas(around, MARGIN.effects);
    this.useFullscreen(program);
    bindTexture(gl, 0, effects, program.uniforms['uEffects']);
    gl.uniform2f(program.uniforms['uArena'], this.width, this.height);
    // The colours go as bytes - the shader scales them.
    gl.uniform3fv(program.uniforms['uColors[0]'], colors);
    gl.uniform1f(program.uniforms['uTime'], frame.timeSec);
    gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ZERO, gl.ONE);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.disable(gl.SCISSOR_TEST);
    this.useAlphaBlend();
  }

  /** The blending everything but the glow is drawn with. */
  private useAlphaBlend(): void {
    const gl = this.gl;
    gl.blendFuncSeparate(
      gl.SRC_ALPHA,
      gl.ONE_MINUS_SRC_ALPHA,
      gl.ONE,
      gl.ONE_MINUS_SRC_ALPHA
    );
  }

  private blurPass(
    source: WebGLTexture,
    target: Target,
    stepX: number,
    stepY: number
  ): void {
    const gl = this.gl;
    const program = this.resources?.programs.blur;
    if (program == null) {
      return;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
    bindTexture(gl, 0, source, program.uniforms['uSource']);
    gl.uniform2i(program.uniforms['uStep'], stepX, stepY);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  /** Draws a batch of shapes in one instanced call. */
  private drawShapes(batch: ShapeBatch): void {
    const gl = this.gl;
    const resources = this.resources;
    if (resources == null || batch.count === 0) {
      return;
    }
    const program = resources.programs.shape;
    gl.useProgram(program.program);
    gl.uniform2f(program.uniforms['uArena'], this.width, this.height);
    gl.bindVertexArray(resources.shapes);
    gl.bindBuffer(gl.ARRAY_BUFFER, resources.instances);
    gl.bufferData(gl.ARRAY_BUFFER, batch.instances, gl.DYNAMIC_DRAW);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, batch.count);
    gl.bindVertexArray(null);
  }

  private useFullscreen(program: Program): void {
    this.gl.useProgram(program.program);
    this.gl.bindVertexArray(this.resources?.quad ?? null);
  }

  /** Paints a level's floor once and hands it to the GPU. */
  private uploadFloor(theme: ArenaTheme): void {
    const gl = this.gl;
    const resources = this.resources;
    if (resources == null) {
      return;
    }
    const pixels = paintArenaBackground(
      new Uint8ClampedArray(this.width * this.height * 4),
      this.width,
      this.height,
      theme
    );
    gl.bindTexture(gl.TEXTURE_2D, resources.floor);
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      0,
      0,
      this.width,
      this.height,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array(pixels.buffer)
    );
    // The next frame lays the new floor down fully, no trail of the old one.
    gl.bindFramebuffer(gl.FRAMEBUFFER, resources.trail.framebuffer);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /** Compiles the programs and allocates every buffer, texture and target. */
  private setup(): Resources {
    const gl = this.gl;
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

    const programs: Programs = {
      floor: createProgram(gl, FULLSCREEN_VERTEX, FLOOR_FRAGMENT, [
        'uFloor',
        'uArena',
        'uAlpha',
      ]),
      blit: createProgram(gl, FULLSCREEN_VERTEX, BLIT_FRAGMENT, ['uImage']),
      blur: createProgram(gl, FULLSCREEN_VERTEX, BLUR_FRAGMENT, [
        'uSource',
        'uStep',
      ]),
      colony: createProgram(gl, FULLSCREEN_VERTEX, COLONY_FRAGMENT, [
        'uDensity',
        'uCells',
        'uArena',
        'uColor',
        'uAlpha',
        'uLook',
        'uShimmer',
        'uBoostTarget',
        'uUnit',
      ]),
      shape: createProgram(gl, SHAPE_VERTEX, SHAPE_FRAGMENT, ['uArena']),
      cells: createProgram(gl, FULLSCREEN_VERTEX, CELLS_FRAGMENT, [
        'uState',
        'uOwner',
        'uMaxEnergy',
        'uSuperMaxEnergy',
      ]),
      effects: createProgram(gl, FULLSCREEN_VERTEX, EFFECTS_FRAGMENT, [
        'uEffects',
        'uArena',
        'uColors[0]',
        'uTime',
      ]),
    };

    const { vao: quad, corners } = createQuad(gl);

    const shapes = gl.createVertexArray();
    gl.bindVertexArray(shapes);
    gl.bindBuffer(gl.ARRAY_BUFFER, corners);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const instances = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, instances);
    const stride = SHAPE_STRIDE * 4;
    for (let attribute = 0; attribute < 4; attribute++) {
      const location = attribute + 1;
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(
        location,
        4,
        gl.FLOAT,
        false,
        stride,
        attribute * 16
      );
      gl.vertexAttribDivisor(location, 1);
    }
    gl.bindVertexArray(null);

    const floor = createTexture(
      gl,
      gl.RGBA8,
      this.width,
      this.height,
      gl.NEAREST
    );
    const cells = createTarget(gl, gl.RG8, this.width, this.height);
    const blur: [Target, Target] = [
      this.target(this.width, this.height, gl.LINEAR),
      this.target(this.width, this.height, gl.LINEAR),
    ];
    const trail = this.target(this.canvasWidth, this.canvasHeight, gl.NEAREST);

    return { programs, quad, shapes, instances, floor, cells, blur, trail };
  }

  /** A target to render into, cleared to black. */
  private target(width: number, height: number, filter: number): Target {
    const gl = this.gl;
    const target = createTarget(gl, gl.RGBA8, width, height, filter);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return target;
  }
}
