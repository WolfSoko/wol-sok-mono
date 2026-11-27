import { sizeCanvas, WaveFrame, WaveLook, WaveRenderer } from '../renderer';
import { frontRadius, hasPreviousSweep, WaveGeometry } from '../wave-model';
import {
  ECHO_LAG,
  WAVE_FRAGMENT_SHADER,
  WAVE_VERTEX_SHADER,
} from './wave-shaders';

const UNIFORMS = [
  'u_size',
  'u_bufferSize',
  'u_spacing',
  'u_dotSize',
  'u_color',
  'u_center',
  'u_frontRadius',
  'u_echoRadius',
  'u_travel',
  'u_previousSweep',
  'u_falloff',
  'u_rise',
  'u_maxPush',
  'u_wave',
  'u_dots',
] as const;

type UniformName = (typeof UNIFORMS)[number];

/** the shaders did not compile or link on this GPU */
export class WaveShaderError extends Error {
  public override readonly name = 'WaveShaderError';
}

export interface WebGlWaveRendererHooks {
  /** the browser took the GPU context away; the renderer draws no more */
  readonly onContextLost: () => void;
  /** called once by dispose(), after the context was freed */
  readonly onDispose?: () => void;
}

/**
 * Draws the wave with a WebGL2 fragment shader: the 2D canvas's look plus a
 * glow around lit dots and an echo ripple trailing the front.
 */
export class WebGlWaveRenderer implements WaveRenderer {
  public readonly kind = 'webgl';
  private readonly program: WebGLProgram;
  private readonly uniforms: Record<UniformName, WebGLUniformLocation | null>;
  private geometry?: WaveGeometry;
  private lost = false;
  private disposed = false;

  private readonly handleContextLost = (event: Event): void => {
    event.preventDefault();
    this.lost = true;
    this.hooks.onContextLost();
  };

  /** @throws WaveShaderError when the shaders fail on this GPU */
  public constructor(
    public readonly canvas: HTMLCanvasElement,
    private readonly gl: WebGL2RenderingContext,
    private look: WaveLook,
    private readonly hooks: WebGlWaveRendererHooks
  ) {
    this.program = linkProgram(gl);
    this.uniforms = Object.fromEntries(
      UNIFORMS.map((name) => [name, gl.getUniformLocation(this.program, name)])
    ) as Record<UniformName, WebGLUniformLocation | null>;
    canvas.addEventListener('webglcontextlost', this.handleContextLost);
  }

  /**
   * A WebGL2 context, or `null` where the browser offers none. With
   * `hardwareOnly` also `null` where it would render on the CPU (no GPU, a
   * blocked driver, a software renderer).
   */
  public static createContext(
    canvas: HTMLCanvasElement,
    hardwareOnly = true
  ): WebGL2RenderingContext | null {
    return canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'low-power',
      failIfMajorPerformanceCaveat: hardwareOnly,
    });
  }

  public resize(geometry: WaveGeometry, pixelRatio: number): void {
    this.geometry = geometry;
    sizeCanvas(this.canvas, geometry, pixelRatio);
    // a GPU may give a smaller drawing buffer than the canvas asks for
    this.gl.viewport(
      0,
      0,
      this.gl.drawingBufferWidth,
      this.gl.drawingBufferHeight
    );
  }

  public draw(frame: WaveFrame): void {
    const { gl, geometry } = this;
    if (this.lost || this.disposed || geometry == null) {
      return;
    }
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (frame.dots <= 0) {
      return;
    }
    gl.useProgram(this.program);
    this.setUniforms(geometry, frame);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  public setLook(look: WaveLook): void {
    this.look = look;
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.canvas.removeEventListener('webglcontextlost', this.handleContextLost);
    if (!this.gl.isContextLost()) {
      this.gl.deleteProgram(this.program);
      this.gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
    this.hooks.onDispose?.();
  }

  private setUniforms(geometry: WaveGeometry, frame: WaveFrame): void {
    const { gl, uniforms, look } = this;
    gl.uniform2f(uniforms.u_size, geometry.width, geometry.height);
    gl.uniform2f(
      uniforms.u_bufferSize,
      gl.drawingBufferWidth,
      gl.drawingBufferHeight
    );
    gl.uniform1f(uniforms.u_spacing, geometry.dotSpacing);
    gl.uniform1f(uniforms.u_dotSize, look.dotSize);
    gl.uniform3f(
      uniforms.u_color,
      look.color.r / 255,
      look.color.g / 255,
      look.color.b / 255
    );
    gl.uniform2f(uniforms.u_center, geometry.centerX, geometry.centerY);
    gl.uniform1f(
      uniforms.u_frontRadius,
      frontRadius(geometry, frame.elapsedMs)
    );
    gl.uniform1f(uniforms.u_echoRadius, echoRadius(geometry, frame.elapsedMs));
    gl.uniform1f(uniforms.u_travel, geometry.travel);
    gl.uniform1f(
      uniforms.u_previousSweep,
      hasPreviousSweep(geometry, frame.elapsedMs) ? 1 : 0
    );
    gl.uniform1f(uniforms.u_falloff, geometry.falloff);
    gl.uniform1f(uniforms.u_rise, geometry.rise);
    gl.uniform1f(uniforms.u_maxPush, geometry.maxPush);
    gl.uniform1f(uniforms.u_wave, frame.wave);
    gl.uniform1f(uniforms.u_dots, frame.dots);
  }
}

/**
 * The echo's radius, trailing the front by `ECHO_LAG` of a sweep; negative,
 * so no echo shows, until the front has run that far.
 */
export function echoRadius(geometry: WaveGeometry, elapsedMs: number): number {
  const echoElapsed = elapsedMs - ECHO_LAG * geometry.sweepMs;
  return echoElapsed < 0 ? -1 : frontRadius(geometry, echoElapsed);
}

function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string
): WebGLShader {
  const shader = gl.createShader(type);
  if (shader == null) {
    throw new WaveShaderError('could not create a shader');
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new WaveShaderError(`shader did not compile: ${log}`);
  }
  return shader;
}

function linkProgram(gl: WebGL2RenderingContext): WebGLProgram {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, WAVE_VERTEX_SHADER);
  let fragment: WebGLShader;
  try {
    fragment = compileShader(gl, gl.FRAGMENT_SHADER, WAVE_FRAGMENT_SHADER);
  } catch (error) {
    gl.deleteShader(vertex);
    throw error;
  }
  const program = gl.createProgram();
  if (program == null) {
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    throw new WaveShaderError('could not create a program');
  }
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  // the program keeps what it needs
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new WaveShaderError(`shaders did not link: ${log}`);
  }
  return program;
}
