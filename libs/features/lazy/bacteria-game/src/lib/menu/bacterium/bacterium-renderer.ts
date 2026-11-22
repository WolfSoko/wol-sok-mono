import { InjectionToken } from '@angular/core';
import { isSoftwareRenderer } from '@wolsok/feat-bacteria-rendering';
import { BACTERIUM_ASPECT, type BacteriumAnchor } from './bacterium-items';
import type { BacteriumLook } from './bacterium-look';
import {
  BACTERIUM_FRAGMENT,
  BACTERIUM_VERTEX,
  MAX_LOBES,
} from './bacterium-shader';

/** What a frame of the cell shows. */
export interface BacteriumScene {
  look: BacteriumLook;
  /** The lobes to draw, at most `MAX_LOBES`. */
  lobes: readonly BacteriumAnchor[];
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
export const MAX_PIXEL_SCALE = 1.5;

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
  const program = isSoftwareRenderer(rendererName(gl)) ? null : linkProgram(gl);
  if (program === null) {
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return null;
  }
  return new GlBacteriumRenderer(gl, program);
}

function rendererName(gl: WebGL2RenderingContext): string {
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  return String(
    gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? ''
  );
}

function linkProgram(gl: WebGL2RenderingContext): WebGLProgram | null {
  const vertex = compile(gl, gl.VERTEX_SHADER, BACTERIUM_VERTEX);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, BACTERIUM_FRAGMENT);
  const program = gl.createProgram();
  if (vertex === null || fragment === null || program === null) {
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    return null;
  }
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.bindAttribLocation(program, 0, 'aCorner');
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(
      'The bacterium shader did not link',
      gl.getProgramInfoLog(program)
    );
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

function compile(
  gl: WebGL2RenderingContext,
  type: number,
  source: string
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (shader === null) {
    return null;
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(
      'The bacterium shader did not compile',
      gl.getShaderInfoLog(shader)
    );
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

class GlBacteriumRenderer implements BacteriumRenderer {
  private readonly uniforms: Record<string, WebGLUniformLocation | null>;
  private readonly lobeData = new Float32Array(MAX_LOBES * 4);
  private readonly corners: WebGLBuffer | null;

  public constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly program: WebGLProgram
  ) {
    this.uniforms = Object.fromEntries(
      [
        'uAspect',
        'uTime',
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
      ].map((name) => [name, gl.getUniformLocation(program, name)])
    );
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
    canvas.width = Math.max(1, Math.round(width * pixels));
    canvas.height = Math.max(1, Math.round(height * pixels));
    this.gl.viewport(0, 0, canvas.width, canvas.height);
  }

  public draw(scene: BacteriumScene, timeMs: number): void {
    const { gl, uniforms: u } = this;
    const { look } = scene;
    const lobes = scene.lobes.slice(0, MAX_LOBES);
    this.lobeData.fill(0);
    lobes.forEach((lobe, i) =>
      this.lobeData.set([lobe.x, lobe.y, lobe.r, 1], i * 4)
    );
    gl.useProgram(this.program);
    gl.uniform1f(u['uAspect'], BACTERIUM_ASPECT);
    gl.uniform1f(u['uTime'], timeMs / 1000);
    gl.uniform4fv(u['uLobes'], this.lobeData);
    gl.uniform1i(u['uLobeCount'], lobes.length);
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
    this.gl.deleteProgram(this.program);
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
