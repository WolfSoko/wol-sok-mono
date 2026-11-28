import type { LoadingWaveShader } from './loading-wave-shader';

/** the shaders did not compile or link on this GPU */
export class WaveShaderError extends Error {
  public override readonly name = 'WaveShaderError';
}

/**
 * The uniforms the lib sets for every shader. `ws_bufferSize` and `ws_dots`
 * are for `main` only.
 */
export const STANDARD_UNIFORMS = [
  'ws_size',
  'ws_bufferSize',
  'ws_pixel',
  'ws_spacing',
  'ws_dotSize',
  'ws_color',
  'ws_accent',
  'ws_center',
  'ws_frontRadius',
  'ws_echoRadius',
  'ws_travel',
  'ws_falloff',
  'ws_rise',
  'ws_tail',
  'ws_maxPush',
  'ws_phase',
  'ws_time',
  'ws_previousSweep',
  'ws_wave',
  'ws_dots',
] as const;

export type StandardUniform = (typeof STANDARD_UNIFORMS)[number];

/** one triangle that covers the whole canvas, no vertex buffer needed */
export const WAVE_VERTEX_SHADER = `#version 300 es
void main() {
  vec2 corner = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(corner * 2.0 - 1.0, 0.0, 1.0);
}
`;

/**
 * What every fragment shader starts with: the uniforms and helpers of the
 * contract (`LoadingWaveShader`). The `WS_*` constants mirror the
 * TypeScript ones (`renderer.ts`, `wave-model.ts`, `echo.ts`);
 * `shader-constants.spec.ts` keeps them equal. Kept a plain literal, so a
 * bundler can tell it has no side effects.
 */
export const WAVE_SHADER_HEADER = `#version 300 es
precision highp float;

uniform vec2 ws_size;
uniform vec2 ws_bufferSize;
uniform float ws_pixel;
uniform float ws_spacing;
uniform float ws_dotSize;
uniform vec4 ws_color;
uniform vec4 ws_accent;
uniform vec2 ws_center;
uniform float ws_frontRadius;
uniform float ws_echoRadius;
uniform float ws_travel;
uniform float ws_falloff;
uniform float ws_rise;
uniform float ws_tail;
uniform float ws_maxPush;
uniform float ws_phase;
uniform float ws_time;
uniform float ws_previousSweep;
uniform float ws_wave;
uniform float ws_dots;

const float WS_REST_ALPHA = 0.22;
const float WS_LIT_ALPHA = 0.9;
const float WS_LIT_GROWTH = 0.8;
const float WS_FRONT_LINE_ALPHA = 0.14;
const float WS_AFTERGLOW = 0.45;
const float WS_AFTERGLOW_FADE_START = 0.45;
const float WS_ECHO_STRENGTH = 0.4;

/** how far p lies behind the front: negative ahead of it */
float ws_behindFront(vec2 p) {
  return ws_frontRadius - length(p - ws_center);
}

/** how far p lies behind the echo; far ahead of it while there is none */
float ws_behindEcho(vec2 p) {
  return ws_echoRadius < 0.0 ? -1.0e6 : ws_echoRadius - length(p - ws_center);
}

/** the bright part right behind a front: 1 there, dimming behind, 0 ahead */
float ws_frontGlow(float behind) {
  return smoothstep(-ws_rise, 0.0, behind) * exp(-max(behind, 0.0) / ws_falloff);
}

/** what stays lit once the front passed, fading until the next one comes */
float ws_afterglow(float behind) {
  if (behind < 0.0 && ws_previousSweep < 0.5) {
    return 0.0;
  }
  float sincePassed = (behind >= 0.0 ? behind : behind + ws_travel) / ws_travel;
  return WS_AFTERGLOW * (1.0 - smoothstep(WS_AFTERGLOW_FADE_START, 1.0, sincePassed));
}

/** the wave's light at p, 0 to 1, already scaled by ws_wave */
float ws_waveIntensity(vec2 p) {
  float behind = ws_behindFront(p);
  return ws_wave * max(ws_frontGlow(behind), ws_afterglow(behind));
}

/** the echo's front glow at p, scaled by its strength and ws_wave */
float ws_echoGlow(vec2 p) {
  return ws_wave * WS_ECHO_STRENGTH * ws_frontGlow(ws_behindEcho(p));
}

/** a stable pseudo-random number in [0, 1) per p, say per grid cell */
float ws_hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

/** two stable pseudo-random numbers in [0, 1) per p */
vec2 ws_hash2(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

/** the grid cell p lies in */
vec2 ws_cell(vec2 p) {
  return floor(p / ws_spacing);
}

/** the centre of a grid cell, where its dot sits */
vec2 ws_cellCenter(vec2 cell) {
  return (cell + 0.5) * ws_spacing;
}

/** anti-aliased coverage, 0 to 1, of a band of the given width at a distance from its middle */
float ws_band(float away, float width) {
  float edge = 0.5 * ws_pixel;
  return 1.0 - smoothstep(0.5 * width - edge, 0.5 * width + edge, away);
}

/** anti-aliased coverage of a disk at p, 0 to 1 */
float ws_dotDisk(vec2 p, vec2 center, float radius) {
  return ws_band(length(p - center), 2.0 * radius);
}

/** the distance from p to the segment from a to b */
float ws_segmentDistance(vec2 p, vec2 a, vec2 b) {
  vec2 ab = b - a;
  float along = clamp(dot(p - a, ab) / max(dot(ab, ab), 1.0e-6), 0.0, 1.0);
  return length(p - a - ab * along);
}

/** anti-aliased coverage of a line of the given width along a segment */
float ws_segment(vec2 p, vec2 a, vec2 b, float width) {
  return ws_band(ws_segmentDistance(p, a, b), width);
}

/** the dots' colour mixed towards the accent by lit, 0 to 1 */
vec4 ws_ink(float lit) {
  return mix(ws_color, ws_accent, clamp(lit, 0.0, 1.0));
}
`;

/**
 * What every fragment shader ends with: maps the drawing buffer onto the
 * host in CSS pixels (y down), calls `wsShade` and fades it by `ws_dots`.
 */
export const WAVE_SHADER_MAIN = `
out vec4 ws_outColor;

void main() {
  // the drawing buffer may be smaller than asked for: map it onto the host
  vec2 cssPerPixel = ws_size / ws_bufferSize;
  vec2 point = vec2(gl_FragCoord.x, ws_bufferSize.y - gl_FragCoord.y) * cssPerPixel;
  vec4 shade = clamp(wsShade(point), 0.0, 1.0);
  float alpha = shade.a * ws_dots;
  ws_outColor = vec4(shade.rgb * alpha, alpha);
}
`;

/** the whole fragment shader for a `LoadingWaveShader` */
export function assembleFragment(shader: LoadingWaveShader): string {
  // `#line 1`: the GPU's compile log counts the shader's own lines
  return `${WAVE_SHADER_HEADER}\n#line 1\n${shader.fragment}\n${WAVE_SHADER_MAIN}`;
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

/**
 * The program of the full-canvas triangle and the shader's fragment.
 * @throws WaveShaderError when it does not compile or link on this GPU
 */
export function linkWaveProgram(
  gl: WebGL2RenderingContext,
  shader: LoadingWaveShader
): WebGLProgram {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, WAVE_VERTEX_SHADER);
  let fragment: WebGLShader;
  try {
    fragment = compileShader(gl, gl.FRAGMENT_SHADER, assembleFragment(shader));
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
