import { AnimationState } from '../animation.state';
import { EFFECT_HEIGHT_SCALE, EFFECT_WIDTH_SCALE } from '../capture-scale';
import { ParticleRenderer, ParticleRendererParams } from '../particle-renderer';
import { WsThanosCrumble } from '../ws-thanos.options';
import {
  PARTICLE_STATE_LENGTH,
  ParticleStateIndex,
  Particles,
} from '../particles';
import {
  AttributeLocation,
  CRACK_FEEDBACK_VARYINGS,
  CRACK_LENGTH,
  CRACK_VERTEX_SHADER,
  CRUMBLE_MODE,
  DRAW_FRAGMENT_SHADER,
  DRAW_VERTEX_SHADER,
  FEEDBACK_FRAGMENT_SHADER,
  UPDATE_FEEDBACK_VARYINGS,
  UPDATE_VERTEX_SHADER,
} from './webgl-shaders';

const FLOAT_BYTES = Float32Array.BYTES_PER_ELEMENT;
const STATE_STRIDE = PARTICLE_STATE_LENGTH * FLOAT_BYTES;
const CRACK_STRIDE = CRACK_LENGTH * FLOAT_BYTES;

const UPDATE_UNIFORMS = [
  'uSize',
  'uDeltaTSec',
  'uAnimationT',
  'uMaxParticleX',
  'uMinParticleY',
  'uParticleAcceleration',
  'uSeed',
  'uCrumble',
  'uPixelScale',
] as const;

const DRAW_UNIFORMS = [
  'uSize',
  'uCrumble',
  'uAnimationT',
  'uPixelScale',
] as const;

type Uniforms<T extends readonly string[]> = Record<
  T[number],
  WebGLUniformLocation | null
>;

/** smallest shard size in css pixels */
const MIN_CELL_SIZE = 28;

/**
 * Simulates and draws the particles on the GPU.
 * The particle state lives in two buffers: every frame the update program reads
 * one and writes the other via transform feedback, then the draw program renders it.
 * Once at the start the crack program computes the shard and crack distances of every particle.
 */
export class WebGlParticleRenderer implements ParticleRenderer {
  public readonly crumble: WsThanosCrumble;
  private readonly updateProgram: WebGLProgram;
  private readonly drawProgram: WebGLProgram;
  private readonly stateBuffers: [WebGLBuffer, WebGLBuffer];
  private readonly colorBuffer: WebGLBuffer;
  private readonly crackBuffer: WebGLBuffer;
  private readonly updateVaos: [WebGLVertexArrayObject, WebGLVertexArrayObject];
  private readonly drawVaos: [WebGLVertexArrayObject, WebGLVertexArrayObject];
  private readonly updateUniforms: Uniforms<typeof UPDATE_UNIFORMS>;
  private readonly drawUniforms: Uniforms<typeof DRAW_UNIFORMS>;
  private current = 0;

  /** get a WebGL2 context for the canvas or null if the browser can't */
  public static createContext(
    canvas: HTMLCanvasElement
  ): WebGL2RenderingContext | null {
    try {
      return canvas.getContext('webgl2', {
        alpha: true,
        premultipliedAlpha: true,
        antialias: false,
        depth: false,
        stencil: false,
      });
    } catch {
      return null;
    }
  }

  /** the largest canvas size the GPU can render into */
  public static maxCanvasSize(gl: WebGL2RenderingContext): number {
    const viewport: ArrayLike<number> =
      gl.getParameter(gl.MAX_VIEWPORT_DIMS) ?? [];
    return Math.min(
      gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),
      viewport[0] ?? Infinity,
      viewport[1] ?? Infinity
    );
  }

  public constructor(
    public readonly canvas: HTMLCanvasElement,
    private readonly gl: WebGL2RenderingContext,
    private readonly particles: Particles,
    private readonly params: ParticleRendererParams
  ) {
    this.crumble = params.crumble;
    canvas.width = params.width;
    canvas.height = params.height;

    this.updateProgram = this.createProgram(
      UPDATE_VERTEX_SHADER,
      FEEDBACK_FRAGMENT_SHADER,
      UPDATE_FEEDBACK_VARYINGS
    );
    this.drawProgram = this.createProgram(
      DRAW_VERTEX_SHADER,
      DRAW_FRAGMENT_SHADER
    );

    this.stateBuffers = [
      this.createBuffer(particles.state, gl.DYNAMIC_COPY),
      this.createBuffer(particles.state, gl.DYNAMIC_COPY),
    ];
    this.colorBuffer = this.createBuffer(particles.colors, gl.STATIC_DRAW);
    this.crackBuffer = this.createCracks();
    this.updateVaos = [
      this.createUpdateVao(this.stateBuffers[0]),
      this.createUpdateVao(this.stateBuffers[1]),
    ];
    this.drawVaos = [
      this.createDrawVao(this.stateBuffers[0]),
      this.createDrawVao(this.stateBuffers[1]),
    ];

    this.updateUniforms = this.uniformLocations(
      this.updateProgram,
      UPDATE_UNIFORMS
    );
    this.drawUniforms = this.uniformLocations(this.drawProgram, DRAW_UNIFORMS);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);
  }

  public render({ deltaTSec, animationT }: AnimationState): void {
    const { gl, particles, params } = this;
    if (gl.isContextLost()) {
      return;
    }
    const next = 1 - this.current;
    const { width, height } = this.canvas;

    // simulate: read the current state, write the next one
    gl.useProgram(this.updateProgram);
    const uniforms = this.updateUniforms;
    gl.uniform2f(uniforms.uSize, width, height);
    gl.uniform1f(uniforms.uDeltaTSec, deltaTSec);
    gl.uniform1f(uniforms.uAnimationT, animationT);
    gl.uniform1f(uniforms.uMaxParticleX, particles.maxParticleX);
    gl.uniform1f(uniforms.uMinParticleY, particles.minParticleY);
    gl.uniform1f(uniforms.uParticleAcceleration, params.particleAcceleration);
    gl.uniform1f(uniforms.uSeed, params.seed);
    gl.uniform1i(uniforms.uCrumble, CRUMBLE_MODE[params.crumble]);
    gl.uniform1f(uniforms.uPixelScale, params.pixelScale);
    gl.bindVertexArray(this.updateVaos[this.current]);
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, this.stateBuffers[next]);
    gl.enable(gl.RASTERIZER_DISCARD);
    gl.beginTransformFeedback(gl.POINTS);
    gl.drawArrays(gl.POINTS, 0, particles.count);
    gl.endTransformFeedback();
    gl.disable(gl.RASTERIZER_DISCARD);
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);

    // draw the next state
    gl.viewport(0, 0, width, height);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.drawProgram);
    gl.uniform2f(this.drawUniforms.uSize, width, height);
    gl.uniform1i(this.drawUniforms.uCrumble, CRUMBLE_MODE[params.crumble]);
    gl.uniform1f(this.drawUniforms.uAnimationT, animationT);
    gl.uniform1f(this.drawUniforms.uPixelScale, params.pixelScale);
    gl.bindVertexArray(this.drawVaos[next]);
    gl.drawArrays(gl.POINTS, 0, particles.count);
    gl.bindVertexArray(null);

    this.current = next;
  }

  public dispose(): void {
    const { gl } = this;
    [...this.updateVaos, ...this.drawVaos].forEach((vao) =>
      gl.deleteVertexArray(vao)
    );
    [...this.stateBuffers, this.colorBuffer, this.crackBuffer].forEach(
      (buffer) => gl.deleteBuffer(buffer)
    );
    gl.deleteProgram(this.updateProgram);
    gl.deleteProgram(this.drawProgram);
    // browsers only allow a few live contexts, free this one right away
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    this.canvas.remove();
  }

  /** run the crack program once: shard center and crack distances per particle */
  private createCracks(): WebGLBuffer {
    const { gl, particles, params } = this;
    const crackBuffer = this.createBuffer(
      new Float32Array(particles.count * CRACK_LENGTH),
      gl.STATIC_COPY
    );
    const program = this.createProgram(
      CRACK_VERTEX_SHADER,
      FEEDBACK_FRAGMENT_SHADER,
      CRACK_FEEDBACK_VARYINGS
    );
    const elementSize = Math.min(
      params.width / EFFECT_WIDTH_SCALE,
      params.height / EFFECT_HEIGHT_SCALE
    );
    const cellSize = Math.max(
      MIN_CELL_SIZE * params.pixelScale,
      elementSize / 2.2
    );

    const vao = this.createVao();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.stateBuffers[0]);
    this.bindStateAttribute(
      AttributeLocation.POSITION,
      2,
      ParticleStateIndex.X
    );
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    gl.useProgram(program);
    gl.uniform1f(gl.getUniformLocation(program, 'uCellSize'), cellSize);
    gl.uniform1f(gl.getUniformLocation(program, 'uSeed'), params.seed);
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, crackBuffer);
    gl.enable(gl.RASTERIZER_DISCARD);
    gl.beginTransformFeedback(gl.POINTS);
    gl.drawArrays(gl.POINTS, 0, particles.count);
    gl.endTransformFeedback();
    gl.disable(gl.RASTERIZER_DISCARD);
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
    gl.bindVertexArray(null);

    gl.deleteVertexArray(vao);
    gl.deleteProgram(program);
    return crackBuffer;
  }

  private uniformLocations<T extends readonly string[]>(
    program: WebGLProgram,
    names: T
  ): Uniforms<T> {
    return names.reduce(
      (uniforms, name) => ({
        ...uniforms,
        [name]: this.gl.getUniformLocation(program, name),
      }),
      {} as Uniforms<T>
    );
  }

  /** shard center and crack distances (vec4) and the shard random (float) */
  private bindCrackAttributes(): void {
    const { gl } = this;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.crackBuffer);
    gl.enableVertexAttribArray(AttributeLocation.CRACK);
    gl.vertexAttribPointer(
      AttributeLocation.CRACK,
      4,
      gl.FLOAT,
      false,
      CRACK_STRIDE,
      0
    );
    gl.enableVertexAttribArray(AttributeLocation.CELL_RANDOM);
    gl.vertexAttribPointer(
      AttributeLocation.CELL_RANDOM,
      1,
      gl.FLOAT,
      false,
      CRACK_STRIDE,
      4 * FLOAT_BYTES
    );
  }

  private createProgram(
    vertexSource: string,
    fragmentSource: string,
    transformFeedbackVaryings?: string[]
  ): WebGLProgram {
    const { gl } = this;
    const program = gl.createProgram();
    if (program == null) {
      throw new Error('Could not create WebGL program');
    }
    const vertexShader = this.compileShader(gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = this.compileShader(
      gl.FRAGMENT_SHADER,
      fragmentSource
    );
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    if (transformFeedbackVaryings) {
      gl.transformFeedbackVaryings(
        program,
        transformFeedbackVaryings,
        gl.INTERLEAVED_ATTRIBS
      );
    }
    gl.linkProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error(`Could not link WebGL program: ${log}`);
    }
    return program;
  }

  private compileShader(type: GLenum, source: string): WebGLShader {
    const { gl } = this;
    const shader = gl.createShader(type);
    if (shader == null) {
      throw new Error('Could not create WebGL shader');
    }
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`Could not compile WebGL shader: ${log}`);
    }
    return shader;
  }

  private createBuffer(
    data: Float32Array | Uint8Array,
    usage: GLenum
  ): WebGLBuffer {
    const { gl } = this;
    const buffer = gl.createBuffer();
    if (buffer == null) {
      throw new Error('Could not create WebGL buffer');
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, usage);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    return buffer;
  }

  private createVao(): WebGLVertexArrayObject {
    const vao = this.gl.createVertexArray();
    if (vao == null) {
      throw new Error('Could not create WebGL vertex array');
    }
    this.gl.bindVertexArray(vao);
    return vao;
  }

  private bindStateAttribute(
    location: number,
    size: number,
    stateIndex: ParticleStateIndex
  ): void {
    const { gl } = this;
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(
      location,
      size,
      gl.FLOAT,
      false,
      STATE_STRIDE,
      stateIndex * FLOAT_BYTES
    );
  }

  private createUpdateVao(stateBuffer: WebGLBuffer): WebGLVertexArrayObject {
    const { gl } = this;
    const vao = this.createVao();
    gl.bindBuffer(gl.ARRAY_BUFFER, stateBuffer);
    this.bindStateAttribute(
      AttributeLocation.POSITION,
      2,
      ParticleStateIndex.X
    );
    this.bindStateAttribute(
      AttributeLocation.VELOCITY,
      2,
      ParticleStateIndex.VX
    );
    this.bindStateAttribute(
      AttributeLocation.ACCELERATION,
      2,
      ParticleStateIndex.AX
    );
    this.bindStateAttribute(
      AttributeLocation.ALPHA,
      1,
      ParticleStateIndex.ALPHA
    );
    this.bindStateAttribute(
      AttributeLocation.RELEASED_AT,
      1,
      ParticleStateIndex.RELEASED_AT
    );
    this.bindCrackAttributes();
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    return vao;
  }

  private createDrawVao(stateBuffer: WebGLBuffer): WebGLVertexArrayObject {
    const { gl } = this;
    const vao = this.createVao();
    gl.bindBuffer(gl.ARRAY_BUFFER, stateBuffer);
    this.bindStateAttribute(
      AttributeLocation.POSITION,
      2,
      ParticleStateIndex.X
    );
    this.bindStateAttribute(
      AttributeLocation.ALPHA,
      1,
      ParticleStateIndex.ALPHA
    );
    this.bindStateAttribute(
      AttributeLocation.RELEASED_AT,
      1,
      ParticleStateIndex.RELEASED_AT
    );
    this.bindCrackAttributes();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
    gl.enableVertexAttribArray(AttributeLocation.COLOR);
    gl.vertexAttribPointer(
      AttributeLocation.COLOR,
      4,
      gl.UNSIGNED_BYTE,
      true,
      0,
      0
    );
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    return vao;
  }
}
