import { GameBalance } from '../../state/game-balance';
import { Bacteria } from '../../state/player.model';
import { CellBounds, emptyBounds, growBounds } from '../../state/geometry';
import { Rect } from '../../state/maps';
import { ArenaFrame, ArenaPainter, PaintedColony } from '../arena-painter';
import { paintArenaBackground } from '../arena-renderer';
import { paintZoneLayer } from '../zone-decal';
import { Zone } from '../../state/zones';
import { ArenaTheme } from '../arena-theme';
import {
  cellDensity,
  colonyBounds,
  hatchPattern,
  jamDrops,
  lookReach,
  LOOKS,
  overcharge,
  StateLayer,
  strengthOf,
} from '../colony-renderer';
import { CELLS_FRAGMENT, MAX_GPU_COLONIES } from '../../gl/simulation-shaders';
import { GpuSimulation, GpuSimulationOptions } from '../../gl/gpu-simulation';
import { rendererOf } from '../../gl/renderer';
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
  MAX_TINTS,
  ZONES_FRAGMENT,
} from './shaders';
import {
  pushBackground,
  pushForeground,
  pushWeaponMarks,
  SHAPE_STRIDE,
  ShapeBatch,
} from './shape-batch';
import {
  ColonyTint,
  MarkLayer,
  TINT_MODES,
  tintApplies,
  TintMode,
  WeaponFx,
} from '../weapon-fx';

/** Each tint mode's number in the colony shader. */
const TINT_INDEX = Object.fromEntries(
  TINT_MODES.map((mode, index) => [mode, index])
) as Record<TintMode, number>;

/**
 * Packs the weapons' tints that shade a colony - the one drawn in that
 * colour - for the colony shader: centre, radius and strength in
 * `circles`, the mode's number in `modes`. Returns how many there are, at
 * most {@link MAX_TINTS}.
 */
export function packTints(
  tints: readonly ColonyTint[],
  colonyColor: readonly number[],
  circles: Float32Array,
  modes: Float32Array
): number {
  let count = 0;
  for (const tint of tints) {
    if (count >= MAX_TINTS) {
      break;
    }
    if (!tintApplies(tint, colonyColor)) {
      continue;
    }
    const at = count * 4;
    circles[at] = tint.x;
    circles[at + 1] = tint.y;
    circles[at + 2] = tint.radius;
    circles[at + 3] = tint.strength;
    modes[count] = TINT_INDEX[tint.mode];
    count++;
  }
  return count;
}

/** A box of arena cells, `[x0, y0, x1, y1]` - x1 and y1 just past it. */
export type CellBox = readonly [number, number, number, number];

/**
 * Packs a colony into the cells texture, two bytes per arena cell: its
 * density - 0 for an empty cell, from 0.55 up for a bacterium, by its
 * strength - and its overcharge. This is all the CPU does for a colony; the
 * blur, the outline, the gloss and the shimmer run on the GPU.
 *
 * Only the cells in `box` are packed, the rest of `out` is left as it was:
 * what is uploaded and read this frame is no more than that box.
 */
export function encodeCells(
  out: Uint8Array,
  width: number,
  bacterias: readonly Bacteria[],
  balance: GameBalance,
  box: CellBox
): void {
  const [x0, y0, x1, y1] = box;
  for (let y = y0; y < y1; y++) {
    out.fill(0, (y * width + x0) * 2, (y * width + x1) * 2);
  }
  for (const { x, y, energy } of bacterias) {
    if (x < x0 || x >= x1 || y < y0 || y >= y1) {
      continue;
    }
    const index = (y * width + x) * 2;
    out[index] = Math.round(255 * cellDensity(strengthOf(energy, balance)));
    out[index + 1] = Math.round(255 * overcharge(energy, balance));
  }
}

/**
 * How far beyond its cells each pass of a colony runs. The colony is drawn
 * 3 cells out - the blur spreads it by two, the slope of the slime reads one
 * more. Each pass reads past its own box, so the one before it has to cover
 * that too: the slime reads the vertical blur 1 cell further out, the
 * vertical blur reads the horizontal one 2 rows further out, the horizontal
 * blur the cells 2 columns. A pass that read past what was blurred this
 * frame would pick up stale density - the other colony's, where the two
 * meet. A look that reaches further past the colony, like the lattice
 * looks with their cells and tiles, moves the whole chain out by its reach
 * ({@link passMargins}).
 */
const MARGIN = {
  colony: 3,
  verticalBlur: 4,
  horizontalBlur: 6,
  /** The glow's halo reaches three cells out. */
  effects: 4,
  cells: 8,
} as const;

/** The margins of a colony's passes for a look that reaches that far past it. */
export function passMargins(reach: number): {
  colony: number;
  verticalBlur: number;
  horizontalBlur: number;
  cells: number;
} {
  return {
    colony: MARGIN.colony + reach,
    verticalBlur: MARGIN.verticalBlur + reach,
    horizontalBlur: MARGIN.horizontalBlur + reach,
    cells: MARGIN.cells + reach,
  };
}

interface Programs {
  floor: Program;
  zones: Program;
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
  /** The zones' layer, finer than the cells - null without zones. */
  zones: WebGLTexture | null;
  /** One colony's cells - uploaded from the CPU, or drawn from the GPU state. */
  cells: Target;
  /** The two halves of the separable blur. */
  blur: [Target, Target];
  /** The frame being built - it survives into the next, for the trail. */
  trail: Target;
}

/**
 * The arena drawn on the GPU with WebGL2: the floor and the fading trail,
 * the colonies in either look, the walls and gates, the weapons' effects
 * (see `WeaponFx`), the jam and the crosshairs. Per frame the CPU only packs each colony's cells into a small
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
  /** The zones painted into the floor. */
  private zones: readonly Zone[] = [];
  private readonly motes: Motes;
  private readonly background = new ShapeBatch();
  private readonly foreground = new ShapeBatch();
  /** The weapons going off and acting, and a batch per layer of them. */
  private readonly weapons: WeaponFx;
  private readonly weaponBatch = new ShapeBatch();
  private readonly tintCircles = new Float32Array(MAX_TINTS * 4);
  private readonly tintModes = new Float32Array(MAX_TINTS);
  private readonly cellBytes: Uint8Array;
  private readonly canvasWidth: number;
  private readonly canvasHeight: number;
  /** Cells per base cell - the jam and the crosshairs are as big on every grid. */
  private readonly unit: number;
  /** Pixels per cell the zones are painted with. */
  private readonly detail: number;
  /** What of the arena the frame being painted shows. */
  private view: Rect;

  /** A painter for the canvas, or null where WebGL2 is not available. */
  public static create(
    canvas: HTMLCanvasElement,
    width: number,
    height: number,
    detail: number,
    unit: number
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
    return gl == null
      ? null
      : new GlArenaPainter(canvas, gl, width, height, detail, unit);
  }

  private constructor(
    canvas: HTMLCanvasElement,
    private readonly gl: WebGL2RenderingContext,
    private readonly width: number,
    private readonly height: number,
    detail: number,
    unit: number
  ) {
    // Sized by `createArenaPainter`.
    this.canvasWidth = canvas.width;
    this.canvasHeight = canvas.height;
    this.unit = unit;
    this.detail = detail;
    this.view = { x: 0, y: 0, width, height };
    this.motes = new Motes(width, height);
    this.weapons = new WeaponFx(unit);
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
      this.uploadZones(this.zones);
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
    random: () => number,
    options: GpuSimulationOptions = {}
  ): GpuSimulation {
    return new GpuSimulation(this.gl, balance, random, options);
  }

  /** The GPU and driver this painter's context renders with. */
  public renderer(): string {
    return rendererOf(this.gl);
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

  public setFloor(theme: ArenaTheme, zones: readonly Zone[]): void {
    if (this.zones !== zones) {
      this.zones = zones;
      this.uploadZones(zones);
    }
    if (this.theme !== theme) {
      this.theme = theme;
      this.motes.reset(theme);
      this.uploadFloor(theme);
    }
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
    this.weapons.update(frame);
    this.view = frame.view;

    gl.bindFramebuffer(gl.FRAMEBUFFER, resources.trail.framebuffer);
    gl.viewport(0, 0, this.canvasWidth, this.canvasHeight);
    gl.enable(gl.BLEND);
    this.useAlphaBlend();

    // Lay the floor over the previous frame, so movement leaves a short trail.
    this.useFullscreen(programs.floor);
    bindTexture(gl, 0, resources.floor, programs.floor.uniforms['uFloor']);
    this.setView(programs.floor);
    gl.uniform2f(programs.floor.uniforms['uArena'], this.width, this.height);
    gl.uniform1f(programs.floor.uniforms['uAlpha'], frame.clear ? 1 : 0.7);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    if (resources.zones != null) {
      this.useFullscreen(programs.zones);
      bindTexture(gl, 0, resources.zones, programs.zones.uniforms['uZones']);
      this.setView(programs.zones);
      gl.uniform2f(programs.zones.uniforms['uArena'], this.width, this.height);
      gl.uniform1f(programs.zones.uniforms['uAlpha'], frame.clear ? 1 : 0.7);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      this.useAlphaBlend();
    }

    this.background.clear();
    pushBackground(
      this.background,
      theme,
      this.motes,
      frame.walls,
      frame.dynamicWalls
    );
    this.drawShapes(this.background);
    this.drawWeaponLayer(this.weapons.ground, false);

    for (const colony of frame.colonies) {
      this.drawColony(frame, colony);
    }
    if (!frame.reducedMotion) {
      this.drawEffects(frame);
    }
    // The weapons over the colonies - the clouds, the ice and the membrane,
    // then their flashes, shockwaves and sparks as light. The crosshairs
    // stay on top of it all.
    this.drawWeaponLayer(this.weapons.over, false);
    this.drawWeaponLayer(this.weapons.light, true);

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
   * GPU simulation's state - are blurred on the arena grid for every look
   * but the pixels, and drawn over the frame in a single pass.
   */
  private drawColony(frame: ArenaFrame, layer: PaintedColony): void {
    const gl = this.gl;
    const resources = this.resources;
    if (resources == null) {
      return;
    }
    const { programs, blur, cells } = resources;
    const { color, boostTarget, look } = layer;
    const bounds =
      layer.kind === 'cells' ? colonyBounds(layer.bacterias) : layer.bounds;
    // A look that reaches past the colony - the lattice looks, with their
    // cells and tiles - is drawn that much further out, and every pass
    // before the drawing moves out with it, or it would read stale density.
    const margin = passMargins(lookReach(look, this.unit));
    if (bounds == null || !this.inView(bounds, margin.colony)) {
      return;
    }
    // Only the box around the colony, as far as it is in view, is packed,
    // blurred and drawn - the rest of the arena would be bytes to upload
    // and fragments the GPU works on to discard them.
    if (layer.kind === 'cells') {
      this.uploadCells(
        layer.bacterias,
        frame.balance,
        this.passBox(bounds, margin.cells)
      );
    }
    gl.enable(gl.SCISSOR_TEST);
    if (layer.kind === 'state') {
      this.drawCellsFromState(layer, bounds, frame.balance, margin.cells);
    }

    const blurred = LOOKS[look].fromDensity;
    if (blurred) {
      gl.disable(gl.BLEND);
      gl.viewport(0, 0, this.width, this.height);
      this.useFullscreen(programs.blur);
      this.scissorCells(bounds, margin.horizontalBlur);
      this.blurPass(cells.texture, blur[0], 1, 0);
      this.scissorCells(bounds, margin.verticalBlur);
      this.blurPass(blur[0].texture, blur[1], 0, 1);
      gl.bindFramebuffer(gl.FRAMEBUFFER, resources.trail.framebuffer);
      gl.viewport(0, 0, this.canvasWidth, this.canvasHeight);
      gl.enable(gl.BLEND);
    }

    this.scissorCanvas(bounds, margin.colony);
    const program = programs.colony;
    this.useFullscreen(program);
    bindTexture(gl, 0, blur[1].texture, program.uniforms['uDensity']);
    bindTexture(gl, 1, cells.texture, program.uniforms['uCells']);
    this.setView(program);
    gl.uniform2f(program.uniforms['uArena'], this.width, this.height);
    gl.uniform3f(
      program.uniforms['uColor'],
      color[0] / 255,
      color[1] / 255,
      color[2] / 255
    );
    gl.uniform1f(program.uniforms['uAlpha'], (color[3] ?? 255) / 255);
    gl.uniform1i(program.uniforms['uLook'], LOOKS[look].glIndex);
    gl.uniform1f(program.uniforms['uUnit'], this.unit);
    gl.uniform1f(
      program.uniforms['uPixel'],
      this.view.width / this.canvasWidth
    );
    gl.uniform1f(program.uniforms['uTime'], frame.timeSec);
    const hatch = hatchPattern(color);
    gl.uniform3f(
      program.uniforms['uHatch'],
      hatch.direction[0],
      hatch.direction[1],
      hatch.cross ? 1 : 0
    );
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
    }
    const tints = packTints(
      this.weapons.tints,
      color,
      this.tintCircles,
      this.tintModes
    );
    gl.uniform1i(program.uniforms['uTintCount'], tints);
    if (tints > 0) {
      gl.uniform4fv(program.uniforms['uTints[0]'], this.tintCircles);
      gl.uniform4fv(program.uniforms['uTintModes'], this.tintModes);
    }
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.disable(gl.SCISSOR_TEST);
  }

  /** The colony's cells grown by a margin, clamped to the arena. */
  private box(bounds: CellBounds, margin: number): CellBox {
    return [
      Math.max(0, bounds.minX - margin),
      Math.max(0, bounds.minY - margin),
      Math.min(this.width, bounds.maxX + 1 + margin),
      Math.min(this.height, bounds.maxY + 1 + margin),
    ];
  }

  /**
   * Scissors a pass on the canvas, whose row 0 is the bottom of the view -
   * cut to the canvas, which a box out of view misses altogether.
   */
  private scissorCanvas(bounds: CellBounds, margin: number): void {
    const [x0, y0, x1, y1] = this.box(bounds, margin);
    const view = this.view;
    const scale = this.canvasWidth / view.width;
    const clampX = (x: number) => Math.min(Math.max(x, 0), this.canvasWidth);
    const clampY = (y: number) => Math.min(Math.max(y, 0), this.canvasHeight);
    // Out to whole pixels - at a scale like 7.5 a cell edge falls inside one.
    const left = clampX(Math.floor((x0 - view.x) * scale));
    const right = clampX(Math.ceil((x1 - view.x) * scale));
    const bottom = clampY(
      Math.floor(this.canvasHeight - (y1 - view.y) * scale)
    );
    const top = clampY(Math.ceil(this.canvasHeight - (y0 - view.y) * scale));
    this.gl.scissor(left, bottom, right - left, top - bottom);
  }

  /** Hands a pass that draws onto the canvas the part of the arena it shows. */
  private setView(program: Program): void {
    const { x, y, width, height } = this.view;
    this.gl.uniform4f(program.uniforms['uView'], x, y, width, height);
  }

  /** True when any of the colony's box, grown by the margin, is in view. */
  private inView(bounds: CellBounds, margin: number): boolean {
    const [x0, y0, x1, y1] = this.box(bounds, margin);
    const { x, y, width, height } = this.view;
    return x0 < x + width && x1 > x && y0 < y + height && y1 > y;
  }

  /**
   * The colony's box grown by a margin, cut to the view grown by the same
   * margin: a pass on the arena grid only has to cover what the passes
   * after it read of the cells in view. The margins grow from one pass to
   * the one before it, so each still covers what the next one reads.
   */
  private passBox(bounds: CellBounds, margin: number): CellBox {
    const [x0, y0, x1, y1] = this.box(bounds, margin);
    const { x, y, width, height } = this.view;
    const left = Math.max(x0, Math.floor(x) - margin);
    const top = Math.max(y0, Math.floor(y) - margin);
    return [
      left,
      top,
      Math.max(left, Math.min(x1, Math.ceil(x + width) + margin)),
      Math.max(top, Math.min(y1, Math.ceil(y + height) + margin)),
    ];
  }

  /** Scissors a pass on the arena grid - its row y is arena row y. */
  private scissorCells(bounds: CellBounds, margin: number): void {
    const [x0, y0, x1, y1] = this.passBox(bounds, margin);
    this.gl.scissor(x0, y0, x1 - x0, y1 - y0);
  }

  /** Packs the box of a CPU colony into the cells texture and uploads it. */
  private uploadCells(
    bacterias: readonly Bacteria[],
    balance: GameBalance,
    box: CellBox
  ): void {
    const gl = this.gl;
    const cells = this.resources?.cells;
    const [x0, y0, x1, y1] = box;
    encodeCells(this.cellBytes, this.width, bacterias, balance, box);
    if (cells == null || x1 <= x0 || y1 <= y0) {
      return;
    }
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, cells.texture);
    // The box's rows, out of the arena's.
    gl.pixelStorei(gl.UNPACK_ROW_LENGTH, this.width);
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      x0,
      y0,
      x1 - x0,
      y1 - y0,
      gl.RG,
      gl.UNSIGNED_BYTE,
      this.cellBytes,
      (y0 * this.width + x0) * 2
    );
    gl.pixelStorei(gl.UNPACK_ROW_LENGTH, 0);
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
    balance: GameBalance,
    /** How far past the bounds to draw - what the horizontal blur reads. */
    margin: number
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
    this.scissorCells(bounds, margin);
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
    this.setView(program);
    gl.uniform2f(program.uniforms['uArena'], this.width, this.height);
    // The colours go as bytes - the shader scales them.
    gl.uniform3fv(program.uniforms['uColors[0]'], colors);
    gl.uniform1f(program.uniforms['uTime'], frame.timeSec);
    gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ZERO, gl.ONE);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.disable(gl.SCISSOR_TEST);
    this.useAlphaBlend();
  }

  /** A layer of the weapons' marks - `light` adds it over the frame as light. */
  private drawWeaponLayer(layer: MarkLayer, light: boolean): void {
    if (layer.count === 0) {
      return;
    }
    const gl = this.gl;
    this.weaponBatch.clear();
    pushWeaponMarks(this.weaponBatch, layer);
    if (light) {
      gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE, gl.ZERO, gl.ONE);
    }
    this.drawShapes(this.weaponBatch);
    if (light) {
      this.useAlphaBlend();
    }
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
    this.setView(program);
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

  /**
   * Paints a level's zones once, as fine as the canvas shows them, and
   * hands them to the GPU - smoothly sampled, for soft edges.
   */
  private uploadZones(zones: readonly Zone[]): void {
    const gl = this.gl;
    const resources = this.resources;
    if (resources == null) {
      return;
    }
    if (resources.zones != null) {
      gl.deleteTexture(resources.zones);
      resources.zones = null;
    }
    const layer = paintZoneLayer(
      this.width,
      this.height,
      zones,
      this.detail,
      this.unit
    );
    if (layer === null) {
      return;
    }
    resources.zones = createTexture(
      gl,
      gl.RGBA8,
      layer.width,
      layer.height,
      gl.LINEAR
    );
    gl.bindTexture(gl.TEXTURE_2D, resources.zones);
    // Premultiplied, so the smooth sampling of an edge never darkens it.
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      0,
      0,
      layer.width,
      layer.height,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array(layer.data.buffer)
    );
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
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
        'uView',
        'uArena',
        'uAlpha',
      ]),
      zones: createProgram(gl, FULLSCREEN_VERTEX, ZONES_FRAGMENT, [
        'uZones',
        'uView',
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
        'uView',
        'uArena',
        'uColor',
        'uAlpha',
        'uLook',
        'uShimmer',
        'uBoostTarget',
        'uUnit',
        'uPixel',
        'uHatch',
        'uTime',
        'uTintCount',
        'uTints[0]',
        'uTintModes',
      ]),
      shape: createProgram(gl, SHAPE_VERTEX, SHAPE_FRAGMENT, ['uView']),
      cells: createProgram(gl, FULLSCREEN_VERTEX, CELLS_FRAGMENT, [
        'uState',
        'uOwner',
        'uMaxEnergy',
        'uSuperMaxEnergy',
      ]),
      effects: createProgram(gl, FULLSCREEN_VERTEX, EFFECTS_FRAGMENT, [
        'uEffects',
        'uView',
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

    return {
      programs,
      quad,
      shapes,
      instances,
      floor,
      zones: null,
      cells,
      blur,
      trail,
    };
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
