import {
  FRONT_LINE_ALPHA,
  LIT_ALPHA,
  LIT_GROWTH,
  REST_ALPHA,
} from '../renderer';
import { AFTERGLOW, AFTERGLOW_FADE_START } from '../wave-model';

/** strength of the echo ripple trailing the front, times the main front's */
export const ECHO_STRENGTH = 0.4;
/** the echo trails the front by this share of a sweep */
export const ECHO_LAG = 1 / 3;
/** opacity of the glow around a dot right behind the front */
const GLOW_ALPHA = 0.18;
/** width of the glow, in dot spacings */
const GLOW_SPACINGS = 0.18;

const glsl = (value: number): string => value.toFixed(5);

/** one triangle that covers the whole canvas, no vertex buffer needed */
export const WAVE_VERTEX_SHADER = `#version 300 es
void main() {
  vec2 corner = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(corner * 2.0 - 1.0, 0.0, 1.0);
}
`;

/**
 * The wave model of `wave-model.ts` (front glow, afterglow, push) per pixel, for every dot of the 3 × 3
 * cells around it: brightness, growth and push behind the front, plus what
 * the 2D canvas cannot afford: a glow around lit dots and an echo ripple
 * trailing the front. Lengths are in CSS pixels, y grows downwards as in CSS.
 * A negative `u_echoRadius` shows no echo, as before the echo's first sweep.
 */
export const WAVE_FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform vec2 u_size;
uniform vec2 u_bufferSize;
uniform float u_spacing;
uniform float u_dotSize;
uniform vec3 u_color;
uniform vec2 u_center;
uniform float u_frontRadius;
uniform float u_echoRadius;
uniform float u_travel;
uniform float u_previousSweep;
uniform float u_falloff;
uniform float u_rise;
uniform float u_maxPush;
uniform float u_wave;
uniform float u_dots;

out vec4 outColor;

const float REST_ALPHA = ${glsl(REST_ALPHA)};
const float LIT_ALPHA = ${glsl(LIT_ALPHA)};
const float LIT_GROWTH = ${glsl(LIT_GROWTH)};
const float FRONT_LINE_ALPHA = ${glsl(FRONT_LINE_ALPHA)};
const float ECHO_STRENGTH = ${glsl(ECHO_STRENGTH)};
const float GLOW_ALPHA = ${glsl(GLOW_ALPHA)};
const float GLOW_SPACINGS = ${glsl(GLOW_SPACINGS)};
const float AFTERGLOW = ${glsl(AFTERGLOW)};
const float AFTERGLOW_FADE_START = ${glsl(AFTERGLOW_FADE_START)};

float frontGlow(float behind) {
  return smoothstep(-u_rise, 0.0, behind) * exp(-max(behind, 0.0) / u_falloff);
}

float afterglow(float behind) {
  if (behind < 0.0 && u_previousSweep < 0.5) {
    return 0.0;
  }
  float sincePassed = (behind >= 0.0 ? behind : behind + u_travel) / u_travel;
  return AFTERGLOW * (1.0 - smoothstep(AFTERGLOW_FADE_START, 1.0, sincePassed));
}

float pushAt(float behind) {
  if (behind <= 0.0) {
    return 0.0;
  }
  float scaled = behind / u_falloff;
  return u_maxPush * scaled * exp(1.0 - scaled);
}

void main() {
  // the drawing buffer may be smaller than asked for: map it onto the host
  vec2 cssPerPixel = u_size / u_bufferSize;
  vec2 point = vec2(gl_FragCoord.x, u_bufferSize.y - gl_FragCoord.y) * cssPerPixel;
  vec2 cell = floor(point / u_spacing);
  float antialias = 0.5 * cssPerPixel.x;
  float glowWidth = GLOW_SPACINGS * u_spacing;
  float alpha = 0.0;
  for (int row = -1; row <= 1; row++) {
    for (int column = -1; column <= 1; column++) {
      vec2 center = (cell + vec2(float(column), float(row)) + 0.5) * u_spacing;
      if (center.x < 0.0 || center.y < 0.0 || center.x >= u_size.x || center.y >= u_size.y) {
        continue;
      }
      vec2 fromWaveCenter = center - u_center;
      float waveDistance = length(fromWaveCenter);
      float behindFront = u_frontRadius - waveDistance;
      float behindEcho = u_echoRadius - waveDistance;
      float fronts = frontGlow(behindFront) + ECHO_STRENGTH * frontGlow(behindEcho);
      float lit = u_wave * clamp(max(fronts, afterglow(behindFront)), 0.0, 1.0);
      float push = u_wave * (pushAt(behindFront) + ECHO_STRENGTH * pushAt(behindEcho));
      vec2 dotCenter = center + push * fromWaveCenter / waveDistance;
      float radius = 0.5 * u_dotSize * (1.0 + LIT_GROWTH * lit);
      float fromDot = length(point - dotCenter);
      float core = 1.0 - smoothstep(radius - antialias, radius + antialias, fromDot);
      // only the fronts glow, the afterglow stays calm
      float glow = GLOW_ALPHA * u_wave * clamp(fronts, 0.0, 1.0)
        * exp(-fromDot * fromDot / (2.0 * glowWidth * glowWidth));
      alpha += core * (REST_ALPHA + (LIT_ALPHA - REST_ALPHA) * lit) + glow;
    }
  }
  float fromFront = abs(length(point - u_center) - u_frontRadius);
  alpha += FRONT_LINE_ALPHA * u_wave * (1.0 - smoothstep(0.0, cssPerPixel.x, fromFront));
  alpha = clamp(alpha, 0.0, 1.0) * u_dots;
  outColor = vec4(u_color * alpha, alpha);
}
`;
