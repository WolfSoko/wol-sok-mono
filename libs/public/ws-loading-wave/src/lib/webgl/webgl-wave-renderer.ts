import {
  sizeCanvas,
  WaveFrame,
  WaveLook,
  WaveRenderer,
  type Rgb,
} from '../renderer';
import {
  frontRadius,
  hasPreviousSweep,
  sweepPhase,
  WaveGeometry,
} from '../wave-model';
import type {
  LoadingWaveShader,
  ShaderUniforms,
  ShaderUniformValue,
} from './loading-wave-shader';
import {
  linkWaveProgram,
  STANDARD_UNIFORMS,
  StandardUniform,
  WaveShaderError,
} from './shader-program';
import { ECHO_LAG } from './echo';

export { WaveShaderError };

export interface WebGlWaveRendererHooks {
  /** the browser took the GPU context away; the renderer draws no more */
  readonly onContextLost: () => void;
  /** called once by dispose(), after the context was freed */
  readonly onDispose?: () => void;
}

/**
 * Draws the wave with a WebGL2 fragment shader (`LoadingWaveShader`) over a
 * full-canvas triangle, setting the contract's `ws_*` uniforms and the
 * shader's own each frame.
 */
export class WebGlWaveRenderer implements WaveRenderer {
  public readonly kind = 'webgl';
  private readonly program: WebGLProgram;
  private readonly uniforms: Record<
    StandardUniform,
    WebGLUniformLocation | null
  >;
  private readonly ownLocations = new Map<
    string,
    WebGLUniformLocation | null
  >();
  private ownUniforms: ShaderUniforms;
  /** uniforms `setShaderUniforms` left out, set to 0 on the next draw */
  private pendingResets: Record<string, ShaderUniformValue> = {};
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
    shader: LoadingWaveShader,
    private readonly hooks: WebGlWaveRendererHooks
  ) {
    this.program = linkWaveProgram(gl, shader);
    this.uniforms = Object.fromEntries(
      STANDARD_UNIFORMS.map((name) => [
        name,
        gl.getUniformLocation(this.program, name),
      ])
    ) as Record<StandardUniform, WebGLUniformLocation | null>;
    this.ownUniforms = shader.uniforms ?? {};
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

  /**
   * a uniform the new values leave out goes back to 0, the value GLSL gives
   * every uniform before it is set
   */
  public setShaderUniforms(uniforms: ShaderUniforms | undefined): void {
    const next = uniforms ?? {};
    for (const [name, value] of Object.entries(this.ownUniforms)) {
      if (!(name in next)) {
        this.pendingResets[name] = unsetValue(value);
      }
    }
    this.ownUniforms = next;
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
    const { gl, uniforms: locations, look } = this;
    const bufferWidth = gl.drawingBufferWidth;
    const bufferHeight = gl.drawingBufferHeight;
    gl.uniform2f(locations.ws_size, geometry.width, geometry.height);
    gl.uniform2f(locations.ws_bufferSize, bufferWidth, bufferHeight);
    gl.uniform1f(locations.ws_pixel, geometry.width / Math.max(1, bufferWidth));
    gl.uniform1f(locations.ws_spacing, geometry.dotSpacing);
    gl.uniform1f(locations.ws_dotSize, look.dotSize);
    setColor(gl, locations.ws_color, look.color);
    setColor(gl, locations.ws_accent, look.accent ?? look.color);
    gl.uniform2f(locations.ws_center, geometry.centerX, geometry.centerY);
    gl.uniform1f(
      locations.ws_frontRadius,
      frontRadius(geometry, frame.elapsedMs)
    );
    gl.uniform1f(
      locations.ws_echoRadius,
      echoRadius(geometry, frame.elapsedMs)
    );
    gl.uniform1f(locations.ws_travel, geometry.travel);
    gl.uniform1f(locations.ws_falloff, geometry.falloff);
    gl.uniform1f(locations.ws_rise, geometry.rise);
    gl.uniform1f(locations.ws_tail, geometry.tail);
    gl.uniform1f(locations.ws_maxPush, geometry.maxPush);
    gl.uniform1f(locations.ws_phase, sweepPhase(geometry, frame.elapsedMs));
    gl.uniform1f(locations.ws_time, frame.elapsedMs / 1000);
    gl.uniform1f(
      locations.ws_previousSweep,
      hasPreviousSweep(geometry, frame.elapsedMs) ? 1 : 0
    );
    gl.uniform1f(locations.ws_wave, frame.wave);
    gl.uniform1f(locations.ws_dots, frame.dots);
    // a dropped uniform is reset once, then left alone
    const own = { ...this.pendingResets, ...this.ownUniforms };
    this.pendingResets = {};
    for (const [name, value] of Object.entries(own)) {
      // the ws_ uniforms are the lib's: a shader's own never override them
      if (!name.startsWith('ws_')) {
        setOwnUniform(gl, this.ownLocation(name), value);
      }
    }
  }

  /** where the shader's own uniform lives, looked up once per name */
  private ownLocation(name: string): WebGLUniformLocation | null {
    if (!this.ownLocations.has(name)) {
      this.ownLocations.set(
        name,
        this.gl.getUniformLocation(this.program, name)
      );
    }
    return this.ownLocations.get(name) ?? null;
  }
}

/** zeros of the same size as `value` */
const ZEROS: Record<1 | 2 | 3 | 4, ShaderUniformValue> = {
  1: [0],
  2: [0, 0],
  3: [0, 0, 0],
  4: [0, 0, 0, 0],
};

function unsetValue(value: ShaderUniformValue): ShaderUniformValue {
  return typeof value === 'number' ? 0 : ZEROS[value.length];
}

/** a colour as a straight RGBA `vec4`, each 0 to 1 */
function setColor(
  gl: WebGL2RenderingContext,
  location: WebGLUniformLocation | null,
  { r, g, b, alpha = 1 }: Rgb
): void {
  gl.uniform4f(location, r / 255, g / 255, b / 255, alpha);
}

/** sets a `float` to `vec4` uniform by how many components the value has */
function setOwnUniform(
  gl: WebGL2RenderingContext,
  location: WebGLUniformLocation | null,
  value: ShaderUniformValue
): void {
  const [x, y = 0, z = 0, w = 0] = typeof value === 'number' ? [value] : value;
  const size = typeof value === 'number' ? 1 : value.length;
  if (size === 1) {
    gl.uniform1f(location, x);
  } else if (size === 2) {
    gl.uniform2f(location, x, y);
  } else if (size === 3) {
    gl.uniform3f(location, x, y, z);
  } else {
    gl.uniform4f(location, x, y, z, w);
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
