import { InjectionToken } from '@angular/core';
import {
  createProgram,
  isSoftwareRenderer,
  type Program,
  rendererOf,
} from '@wolsok/feat-bacteria-rendering';
import { BACTERIUM_ASPECT, type BacteriumAnchor } from './bacterium-items';
import type { BacteriumLook } from './bacterium-look';
import {
  BACTERIUM_FRAGMENT,
  BACTERIUM_VERTEX,
  MAX_LOBES,
} from './bacterium-shader';

/** A lobe to draw: where it sits, and whether it glows gold. */
export interface BacteriumLobe extends BacteriumAnchor {
  /** True while its part's DNA buys something (`BacteriumItem.ready`). */
  ready: boolean;
}

/** What a frame of the cell shows. */
export interface BacteriumScene {
  look: BacteriumLook;
  /** The lobes to draw, at most `MAX_LOBES`. */
  lobes: readonly BacteriumLobe[];
  /** The lobe lit up: its index, `MAX_LOBES` for the nucleus, -1 for none. */
  hot: number;
}

/** Draws the cell on a canvas, frame by frame. */
export interface BacteriumRenderer {
  /** Sizes the drawing buffer to the canvas's CSS box at `scale` pixels. */
  resize(width: number, height: number, scale: number): void;
  draw(scene: BacteriumScene, timeMs: number): void;
  dispose(): void;
}

/**
 * Starts a renderer on a canvas - null where the cell is drawn without
 * WebGL: no WebGL2, a software renderer (which takes far too long a
 * frame), or a shader the device refuses. A spec provides its own.
 */
export type BacteriumRendererFactory = (
  canvas: HTMLCanvasElement
) => BacteriumRenderer | null;

export const BACTERIUM_RENDERER = new InjectionToken<BacteriumRendererFactory>(
  'BACTERIUM_RENDERER',
  { providedIn: 'root', factory: () => createBacteriumRenderer }
);

/** The most device pixels a CSS pixel of the cell gets. */
const MAX_PIXEL_SCALE = 1.5;

/** How fast the cell turns about its long axis, in radians a second. */
const TURN_SPEED = 0.35;

const UNIFORMS = [
  'uAspect',
  'uTime',
  'uTurn',
  'uHotSwell',
  'uLobes',
  'uLobeCount',
  'uHot',
  'uFlagella',
  'uPili',
  'uOrganelles',
  'uGlow',
  'uWobble',
  'uBody',
  'uRim',
] as const;

export function createBacteriumRenderer(
  canvas: HTMLCanvasElement
): BacteriumRenderer | null {
  const gl = canvas.getContext('webgl2', {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    powerPreference: 'low-power',
  });
  if (gl === null) {
    return null;
  }
  const program = isSoftwareRenderer(rendererOf(gl)) ? null : linkProgram(gl);
  if (program === null) {
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return null;
  }
  return new GlBacteriumRenderer(gl, program);
}

/**
 * Writes the lobes into the shader's `uLobes`, four floats each: x, y, the
 * radius and 1 for a ready lobe (0 otherwise); the rest is cleared. Answers
 * how many it wrote, at most `MAX_LOBES`.
 */
export function packLobes(
  lobes: readonly BacteriumLobe[],
  into: Float32Array
): number {
  const count = Math.min(lobes.length, MAX_LOBES, into.length / 4);
  into.fill(0);
  for (let i = 0; i < count; i++) {
    const lobe = lobes[i];
    into[i * 4] = lobe.x;
    into[i * 4 + 1] = lobe.y;
    into[i * 4 + 2] = lobe.r;
    into[i * 4 + 3] = lobe.ready ? 1 : 0;
  }
  return count;
}

/** The cell's program, null for a shader the device refuses. */
function linkProgram(gl: WebGL2RenderingContext): Program | null {
  try {
    return createProgram(gl, BACTERIUM_VERTEX, BACTERIUM_FRAGMENT, UNIFORMS);
  } catch (error) {
    console.error('The bacterium shader failed', error);
    return null;
  }
}

class GlBacteriumRenderer implements BacteriumRenderer {
  private readonly lobeData = new Float32Array(MAX_LOBES * 4);
  private readonly corners: WebGLBuffer | null;

  public constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly program: Program
  ) {
    this.corners = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.corners);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  }

  public resize(width: number, height: number, scale: number): void {
    const canvas = this.gl.canvas as HTMLCanvasElement;
    const pixels = Math.min(scale, MAX_PIXEL_SCALE);
    const w = Math.max(1, Math.round(width * pixels));
    const h = Math.max(1, Math.round(height * pixels));
    if (canvas.width === w && canvas.height === h) {
      return;
    }
    canvas.width = w;
    canvas.height = h;
    this.gl.viewport(0, 0, w, h);
  }

  public draw(scene: BacteriumScene, timeMs: number): void {
    const { gl } = this;
    const u = this.program.uniforms;
    const { look } = scene;
    const seconds = timeMs / 1000;
    const turn = seconds * TURN_SPEED;
    const count = packLobes(scene.lobes, this.lobeData);
    gl.useProgram(this.program.program);
    gl.uniform1f(u['uAspect'], BACTERIUM_ASPECT);
    gl.uniform1f(u['uTime'], seconds);
    gl.uniform2f(u['uTurn'], Math.cos(turn), Math.sin(turn));
    gl.uniform1f(u['uHotSwell'], 1.22 + 0.04 * Math.sin(seconds * 4));
    gl.uniform4fv(u['uLobes'], this.lobeData);
    gl.uniform1i(u['uLobeCount'], count);
    gl.uniform1i(u['uHot'], scene.hot);
    gl.uniform1f(u['uFlagella'], look.flagella);
    gl.uniform1f(u['uPili'], look.pili);
    gl.uniform1f(u['uOrganelles'], look.organelles);
    gl.uniform1f(u['uGlow'], look.glow);
    gl.uniform1f(u['uWobble'], look.wobble);
    gl.uniform3fv(u['uBody'], look.body);
    gl.uniform3fv(u['uRim'], look.rim);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  public dispose(): void {
    this.gl.deleteBuffer(this.corners);
    this.gl.deleteProgram(this.program.program);
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
