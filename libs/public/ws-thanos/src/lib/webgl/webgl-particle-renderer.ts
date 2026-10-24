import { AnimationState } from '../animation.state';
import { EFFECT_HEIGHT_SCALE, EFFECT_WIDTH_SCALE } from '../capture-scale';
import { crumbleShape } from '../crumble-shape';
import { ParticleRenderer, ParticleRendererParams } from '../particle-renderer';
import {
  PARTICLE_STATE_LENGTH,
  ParticleStateIndex,
  Particles,
} from '../particles';
import { vaporizingFront } from '../vaporizing-front';
import { WsThanosCrumble } from '../ws-thanos.options';
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
  'uParticleAcceleration',
  'uSeed',
  'uCrumble',
  'uPixelScale',
  'uFrontTime',
  'uFrontRadiusPow',
  'uFade',
  'uCoarseCrack',
  'uFineCrack',
  'uShardGrow',
] as const;

const DRAW_UNIFORMS = ['uSize', 'uPixelScale', 'uShardGrow'] as const;

type Uniforms<T extends readonly string[]> = Record<
  T[number],
  WebGLUniformLocation | null
>;

/** one vertex attribute read from a buffer */
interface AttributeBinding {
  buffer: WebGLBuffer;
  location: number;
  size: number;
  type?: GLenum;
  normalized?: boolean;
  stride: number;
  offset: number;
}

/** smallest shard size in css pixels */
const MIN_CELL_SIZE = 28;

/**
 * Simulates and draws the particles on the GPU.
 * The particle state lives in two buffers: every frame the update program reads
 * one and writes the other via transform feedback, then the draw program renders it.
 * Once at the start the crack program computes the shard and crack distances of every particle.
 */
export class WebGlParticleRenderer implements ParticleRenderer {
  public readonly kind = 'webgl';
  public readonly crumble: WsThanosCrumble;
  private readonly count: number;
  private readonly maxParticleX: number;
  private readonly minParticleY: number;
  private readonly updateProgram: WebGLProgram;
  private readonly drawProgram: WebGLProgram;
  private readonly buffers: WebGLBuffer[] = [];
  private readonly stateBuffers: WebGLBuffer[];
  private readonly updateVaos: WebGLVertexArrayObject[];
  private readonly drawVaos: WebGLVertexArrayObject[];
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
    // only the scalars are kept, the particle arrays live on the GPU
    particles: Particles,
    private readonly params: ParticleRendererParams
  ) {
    this.crumble = params.crumble;
    this.count = particles.count;
    this.maxParticleX = particles.maxParticleX;
    this.minParticleY = particles.minParticleY;
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

    // the second state buffer is written by the first frame, it needs no data
    this.stateBuffers = [
      this.createBuffer(particles.state, gl.DYNAMIC_COPY),
      this.createBuffer(particles.state.byteLength, gl.DYNAMIC_COPY),
    ];
    const colorBuffer = this.createBuffer(particles.colors, gl.STATIC_DRAW);
    // dust has no cracks, the shaders then read the default attribute values
    const crackBuffer =
      params.crumble === 'dust' ? undefined : this.createCracks();

    const crackAttributes: AttributeBinding[] = crackBuffer
      ? [
          {
            buffer: crackBuffer,
            location: AttributeLocation.CRACK,
            size: 4,
            stride: CRACK_STRIDE,
            offset: 0,
          },
          {
            buffer: crackBuffer,
            location: AttributeLocation.CELL_RANDOM,
            size: 1,
            stride: CRACK_STRIDE,
            offset: 4 * FLOAT_BYTES,
          },
        ]
      : [];
    this.updateVaos = this.stateBuffers.map((buffer) =>
      this.createVao([
        ...stateAttributes(buffer, [
          [AttributeLocation.POSITION, 2, ParticleStateIndex.X],
          [AttributeLocation.VELOCITY, 2, ParticleStateIndex.VX],
          [AttributeLocation.ACCELERATION, 2, ParticleStateIndex.AX],
          [AttributeLocation.ALPHA, 1, ParticleStateIndex.ALPHA],
          [AttributeLocation.RELEASED_AT, 1, ParticleStateIndex.RELEASED_AT],
        ]),
        ...crackAttributes,
      ])
    );
    this.drawVaos = this.stateBuffers.map((buffer) =>
      this.createVao([
        ...stateAttributes(buffer, [
          [AttributeLocation.POSITION, 2, ParticleStateIndex.X],
          [AttributeLocation.ALPHA, 1, ParticleStateIndex.ALPHA],
          [AttributeLocation.RELEASED_AT, 1, ParticleStateIndex.RELEASED_AT],
        ]),
        ...crackAttributes,
        {
          buffer: colorBuffer,
          location: AttributeLocation.COLOR,
          size: 4,
          type: gl.UNSIGNED_BYTE,
          normalized: true,
          stride: 0,
          offset: 0,
        },
      ])
    );

    this.updateUniforms = this.uniformLocations(
      this.updateProgram,
      UPDATE_UNIFORMS
    );
    this.drawUniforms = this.uniformLocations(this.drawProgram, DRAW_UNIFORMS);

    // everything that stays the same for the whole animation is set once
    gl.useProgram(this.updateProgram);
    gl.uniform2f(this.updateUniforms.uSize, params.width, params.height);
    gl.uniform1f(
      this.updateUniforms.uParticleAcceleration,
      params.particleAcceleration
    );
    gl.uniform1f(this.updateUniforms.uSeed, params.seed);
    gl.uniform1i(this.updateUniforms.uCrumble, CRUMBLE_MODE[params.crumble]);
    gl.uniform1f(this.updateUniforms.uPixelScale, params.pixelScale);
    gl.useProgram(this.drawProgram);
    gl.uniform2f(this.drawUniforms.uSize, params.width, params.height);
    gl.uniform1f(this.drawUniforms.uPixelScale, params.pixelScale);

    gl.viewport(0, 0, params.width, params.height);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);
  }

  public render({ deltaTSec, animationT }: AnimationState): void {
    const { gl, params } = this;
    if (gl.isContextLost()) {
      return;
    }
    const next = 1 - this.current;
    const front = vaporizingFront(
      animationT,
      this.maxParticleX,
      this.minParticleY,
      params.height
    );
    const shape = crumbleShape(params.crumble, animationT);

    // simulate: read the current state, write the next one
    const uniforms = this.updateUniforms;
    gl.useProgram(this.updateProgram);
    gl.uniform1f(uniforms.uDeltaTSec, deltaTSec);
    gl.uniform1f(uniforms.uAnimationT, animationT);
    gl.uniform1f(uniforms.uFrontTime, front.time);
    gl.uniform1f(uniforms.uFrontRadiusPow, front.radiusPow);
    gl.uniform1f(uniforms.uFade, front.fade);
    gl.uniform1f(uniforms.uCoarseCrack, shape.coarseCrack * params.pixelScale);
    gl.uniform1f(uniforms.uFineCrack, shape.fineCrack * params.pixelScale);
    gl.uniform1f(uniforms.uShardGrow, shape.shardGrow);
    gl.bindVertexArray(this.updateVaos[this.current]);
    this.runTransformFeedback(this.stateBuffers[next]);

    // draw the next state
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.drawProgram);
    gl.uniform1f(this.drawUniforms.uShardGrow, shape.shardGrow);
    gl.bindVertexArray(this.drawVaos[next]);
    gl.drawArrays(gl.POINTS, 0, this.count);
    gl.bindVertexArray(null);

    this.current = next;
  }

  public dispose(): void {
    const { gl } = this;
    [...this.updateVaos, ...this.drawVaos].forEach((vao) =>
      gl.deleteVertexArray(vao)
    );
    this.buffers.forEach((buffer) => gl.deleteBuffer(buffer));
    gl.deleteProgram(this.updateProgram);
    gl.deleteProgram(this.drawProgram);
    // browsers only allow a few live contexts, free this one right away
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    this.canvas.remove();
  }

  /** run the bound vertex array through the bound program into the target buffer */
  private runTransformFeedback(target: WebGLBuffer): void {
    const { gl } = this;
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, target);
    gl.enable(gl.RASTERIZER_DISCARD);
    gl.beginTransformFeedback(gl.POINTS);
    gl.drawArrays(gl.POINTS, 0, this.count);
    gl.endTransformFeedback();
    gl.disable(gl.RASTERIZER_DISCARD);
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
  }

  /** run the crack program once: shard center and crack distances per particle */
  private createCracks(): WebGLBuffer {
    const { gl, params } = this;
    const crackBuffer = this.createBuffer(
      this.count * CRACK_STRIDE,
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
    const uniforms = this.uniformLocations(program, [
      'uCellSize',
      'uSeed',
    ] as const);

    // the first state buffer still holds the start positions
    const vao = this.createVao(
      stateAttributes(this.stateBuffers[0], [
        [AttributeLocation.POSITION, 2, ParticleStateIndex.X],
      ])
    );
    gl.useProgram(program);
    gl.uniform1f(uniforms.uCellSize, cellSize);
    gl.uniform1f(uniforms.uSeed, params.seed);
    gl.bindVertexArray(vao);
    this.runTransformFeedback(crackBuffer);
    gl.bindVertexArray(null);

    gl.deleteVertexArray(vao);
    gl.deleteProgram(program);
    return crackBuffer;
  }

  private uniformLocations<T extends readonly string[]>(
    program: WebGLProgram,
    names: T
  ): Uniforms<T> {
    const uniforms = {} as Uniforms<T>;
    for (const name of names) {
      uniforms[name as T[number]] = this.gl.getUniformLocation(program, name);
    }
    return uniforms;
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

  /** a buffer with the given data, or of the given byte size when it is filled on the GPU */
  private createBuffer(
    data: Float32Array | Uint8Array | number,
    usage: GLenum
  ): WebGLBuffer {
    const { gl } = this;
    const buffer = gl.createBuffer();
    if (buffer == null) {
      throw new Error('Could not create WebGL buffer');
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    // bufferData has separate overloads for a byte size and for data
    if (typeof data === 'number') {
      gl.bufferData(gl.ARRAY_BUFFER, data, usage);
    } else {
      gl.bufferData(gl.ARRAY_BUFFER, data, usage);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    this.buffers.push(buffer);
    return buffer;
  }

  private createVao(bindings: AttributeBinding[]): WebGLVertexArrayObject {
    const { gl } = this;
    const vao = gl.createVertexArray();
    if (vao == null) {
      throw new Error('Could not create WebGL vertex array');
    }
    gl.bindVertexArray(vao);
    for (const binding of bindings) {
      gl.bindBuffer(gl.ARRAY_BUFFER, binding.buffer);
      gl.enableVertexAttribArray(binding.location);
      gl.vertexAttribPointer(
        binding.location,
        binding.size,
        binding.type ?? gl.FLOAT,
        binding.normalized ?? false,
        binding.stride,
        binding.offset
      );
    }
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    return vao;
  }
}

/** attributes read from the interleaved particle state */
function stateAttributes(
  buffer: WebGLBuffer,
  attributes: [location: number, size: number, index: ParticleStateIndex][]
): AttributeBinding[] {
  return attributes.map(([location, size, index]) => ({
    buffer,
    location,
    size,
    stride: STATE_STRIDE,
    offset: index * FLOAT_BYTES,
  }));
}
