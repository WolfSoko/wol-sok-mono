/**
 * The GLSL of the WebGL2 arena painter. All passes draw in arena cells:
 * `p` below is a position in cells with the origin at the top left, the
 * same coordinates the simulation uses.
 */

import {
  LOSER_SHIFT,
  MAX_GPU_COLONIES,
  RECORD_MASK,
} from '../../gl/simulation-shaders';

/** The arena position under a fragment of a full screen pass. */
const ARENA_POSITION = `
vec2 arenaPosition(vec2 ndc, vec2 arena) {
  return vec2((ndc.x + 1.0) * 0.5 * arena.x, (1.0 - ndc.y) * 0.5 * arena.y);
}`;

/** A cheap integer hash, for sparkles that look random. */
const HASH = `
uint hash(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z;
  v.y += v.z * v.x;
  v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z;
  return v.x;
}`;

/**
 * Lays the floor over the trail of the last frame - at partial opacity,
 * which fades what moved into a short trail, or fully to clear it.
 */
export const FLOOR_FRAGMENT = `#version 300 es
precision highp float;
in vec2 vNdc;
uniform sampler2D uFloor;
uniform vec2 uArena;
uniform float uAlpha;
out vec4 outColor;
${ARENA_POSITION}
void main() {
  ivec2 cell = clamp(
    ivec2(floor(arenaPosition(vNdc, uArena))),
    ivec2(0),
    ivec2(uArena) - 1
  );
  outColor = vec4(texelFetch(uFloor, cell, 0).rgb, uAlpha);
}`;

/** Copies the finished frame onto the canvas. */
export const BLIT_FRAGMENT = `#version 300 es
precision highp float;
in vec2 vNdc;
uniform sampler2D uImage;
out vec4 outColor;
void main() {
  outColor = vec4(texture(uImage, (vNdc + 1.0) * 0.5).rgb, 1.0);
}`;

/**
 * One axis of the colony blur, on the arena grid. The kernel 1-2-3-2-1 is a
 * 3 cell box applied twice - what melts neighbours into one blob - and the
 * edges are clamped, as on the CPU.
 */
export const BLUR_FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D uSource;
uniform ivec2 uStep;
out vec4 outColor;
void main() {
  ivec2 size = textureSize(uSource, 0);
  ivec2 cell = ivec2(gl_FragCoord.xy);
  float weights[5] = float[5](1.0, 2.0, 3.0, 2.0, 1.0);
  vec4 sum = vec4(0.0);
  for (int i = -2; i <= 2; i++) {
    ivec2 at = clamp(cell + uStep * i, ivec2(0), size - 1);
    sum += texelFetch(uSource, at, 0) * weights[i + 2];
  }
  outColor = sum / 9.0;
}`;

/**
 * One colony, in the slime or the pixel look.
 *
 * Slime: the blurred density is sampled with linear filtering, so the
 * outline where it crosses the threshold is a smooth curve at full canvas
 * resolution. A dark rim sits just inside it, a gloss where the surface
 * faces the light, white heat where the colony is overcharged - and while
 * it is boosted, waves of light rush across it towards its crosshair with a
 * sparkle here and there.
 *
 * Pixels: one crisp cell per bacterium from the raw cells, weak ones faded
 * and hot ones burning white.
 *
 * The cells texture holds the density of a bacterium in red (0 for an
 * empty cell) and its overcharge in green.
 */
export const COLONY_FRAGMENT = `#version 300 es
precision highp float;
precision highp int;
in vec2 vNdc;
uniform sampler2D uDensity;
uniform sampler2D uCells;
uniform vec2 uArena;
uniform vec3 uColor;
uniform float uAlpha;
uniform int uLook;
uniform float uShimmer;
uniform vec2 uBoostTarget;
uniform float uUnit;
out vec4 outColor;
${ARENA_POSITION}

const float EDGE_START = 0.07;
const float EDGE_END = 0.17;
const vec2 LIGHT = vec2(-0.6, -0.8);

// Crests closing in on the crosshair - see shimmerAt in colony-renderer.ts.
float shimmer(vec2 p, float t) {
  float distance = length(p - uBoostTarget) / uUnit;
  float wave = 0.5 + 0.5 * sin(t * 9.0 + distance * 0.35);
  float squared = wave * wave;
  return squared * squared * squared;
}

${HASH}

bool sparkle(vec2 p, float t) {
  uvec3 key = uvec3(uvec2(floor(p)), uint(floor(t * 10.0)));
  return float(hash(key)) / 4294967295.0 > 0.992;
}

void main() {
  vec2 p = arenaPosition(vNdc, uArena);
  bool boosted = uShimmer >= 0.0;

  if (uLook == 1) {
    vec2 cell = floor(p);
    vec2 texel = texelFetch(uCells, ivec2(cell), 0).rg;
    if (texel.r <= 0.0) {
      discard;
    }
    float heat = texel.g;
    if (boosted) {
      heat = max(heat, shimmer(cell, uShimmer));
    }
    if (heat > 0.0) {
      outColor = vec4(uColor + (1.0 - uColor) * heat, uAlpha);
      return;
    }
    float strength = clamp((texel.r - 0.55) / 0.45, 0.0, 1.0);
    outColor = vec4(uColor, uAlpha * (0.3 + 0.7 * strength * strength));
    return;
  }

  vec2 texel = 1.0 / uArena;
  vec2 uv = p / uArena;
  vec2 sampled = texture(uDensity, uv).rg;
  float density = sampled.r;
  float coverage = smoothstep(EDGE_START, EDGE_END, density);
  if (coverage <= 0.0) {
    discard;
  }

  // The slope of the surface, per cell.
  float slopeX = (texture(uDensity, uv + vec2(texel.x, 0.0)).r
    - texture(uDensity, uv - vec2(texel.x, 0.0)).r) * 0.5;
  float slopeY = (texture(uDensity, uv + vec2(0.0, texel.y)).r
    - texture(uDensity, uv - vec2(0.0, texel.y)).r) * 0.5;
  float lit = clamp(-(slopeX * LIGHT.x + slopeY * LIGHT.y) * 5.0, 0.0, 1.0);
  float gloss = lit * lit * lit;
  // Thick slime is deeper in colour; the edge is a darker rim.
  float depth = 0.8 + 0.2 * (1.0 - min(1.0, density));
  float rim = 1.0 - 0.45 * coverage * (1.0 - coverage) * 4.0;
  float shade = depth * rim;
  float white = max(gloss * 0.75, min(1.0, sampled.g / max(density, 0.05)));

  if (boosted) {
    float wave = shimmer(p, uShimmer);
    white = max(white, wave * 0.8);
    shade = max(shade, 0.85 + 0.15 * wave);
    if (sparkle(p * 2.0, uShimmer)) {
      white = 1.0;
    }
  }

  vec3 body = uColor * shade;
  outColor = vec4(body + (1.0 - body) * white, 0.94 * coverage * uAlpha);
}`;

/**
 * The glow of what the colonies do, added over them - from the GPU
 * simulation's effects (see its `EFFECTS_FRAGMENT`):
 * - fights spark, white hot where a cell was just taken and orange at the
 *   rim, flickering as they fade
 * - eating bacteria bubble in the pink of sweet juice
 * - a colony pushing forward gleams in its own colour at the front, and
 *   leaves a fading streak behind
 */
export const EFFECTS_FRAGMENT = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
in vec2 vNdc;
uniform sampler2D uEffects;
uniform vec2 uArena;
uniform vec3 uColors[${MAX_GPU_COLONIES}]; // 0 to 255
uniform float uTime;
out vec4 outColor;
${ARENA_POSITION}
${HASH}

const vec2 AXES[4] = vec2[4](vec2(1.0, 0.0), vec2(-1.0, 0.0), vec2(0.0, 1.0), vec2(0.0, -1.0));
const vec2 DIAGONALS[4] = vec2[4](vec2(0.7, 0.7), vec2(-0.7, 0.7), vec2(0.7, -0.7), vec2(-0.7, -0.7));

float noise(vec2 cell, float t, uint salt) {
  return float(hash(uvec3(uvec2(cell), uint(t) * 7u + salt))) / 4294967295.0;
}

void main() {
  vec2 p = arenaPosition(vNdc, uArena);
  vec2 texel = 1.0 / uArena;
  vec2 uv = p / uArena;
  vec4 here = texture(uEffects, uv);
  // A soft halo: the heat a cell and a half around, and fainter three out
  // on the diagonals, so the two rings together come out round.
  vec3 near = vec3(0.0);
  vec3 far = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    near += texture(uEffects, uv + AXES[i] * 1.5 * texel).rgb;
    far += texture(uEffects, uv + DIAGONALS[i] * 3.0 * texel).rgb;
  }
  near *= 0.25;
  far *= 0.25;
  float fight = max(here.r, max(near.r * 0.8, far.r * 0.45));
  float eat = max(here.g, near.g * 0.6);
  float move = here.b;
  if (fight + eat + move < 0.02) {
    discard;
  }

  vec2 cell = floor(p);
  vec3 color = vec3(0.0);
  float flicker = 0.55 + 0.45 * noise(cell, uTime * 24.0, 1u);
  vec3 ember = mix(vec3(1.0, 0.3, 0.04), vec3(1.0, 0.96, 0.82), here.r * here.r);
  color += ember * fight * flicker * 1.5;
  // Sparks crackle around a fight: single cells flaring white for a blink.
  if (fight > 0.08 && noise(cell, uTime * 30.0, 3u) > 0.86) {
    color += vec3(1.0, 0.9, 0.7) * fight * 1.8;
  }

  float phase = noise(cell, 0.0, 2u) * 6.2832;
  float bubble = 0.5 + 0.5 * sin(uTime * 9.0 + phase);
  color += vec3(1.0, 0.5, 0.78) * eat * (0.25 + 0.45 * bubble * bubble);

  uint packed = uint(round(texelFetch(uEffects, ivec2(cell), 0).a * 255.0));
  // The owner the glow follows sits above the last owner - see EFFECTS_FRAGMENT.
  uint owner = (packed >> ${LOSER_SHIFT}u) & ${RECORD_MASK}u;
  if (owner != 0u) {
    color += mix(uColors[owner - 1u] / 255.0, vec3(1.0), 0.45) * move * 0.35;
  }
  outColor = vec4(color, 1.0);
}`;

/**
 * The zones' layer over the floor - finer than the cells, and sampled
 * smoothly, so their edges are soft.
 */
export const ZONES_FRAGMENT = `#version 300 es
precision highp float;
in vec2 vNdc;
uniform sampler2D uZones;
uniform vec2 uArena;
uniform float uAlpha;
out vec4 outColor;
${ARENA_POSITION}
void main() {
  // Premultiplied: the colour fades with the alpha.
  outColor = texture(uZones, arenaPosition(vNdc, uArena) / uArena) * uAlpha;
}`;

/** One instance per shape, its rect in arena cells - see `SHAPE`. */
export const SHAPE_VERTEX = `#version 300 es
layout(location = 0) in vec2 aCorner;
layout(location = 1) in vec4 aRect;
layout(location = 2) in vec4 aColor;
layout(location = 3) in vec4 aColor2;
layout(location = 4) in vec4 aExtra;
uniform vec2 uArena;
out vec2 vWorld;
flat out vec4 vRect;
flat out vec4 vColor;
flat out vec4 vColor2;
flat out vec4 vExtra;
void main() {
  vec2 world = aRect.xy + aCorner * aRect.zw;
  vWorld = world;
  vRect = aRect;
  vColor = aColor;
  vColor2 = aColor2;
  vExtra = aExtra;
  gl_Position = vec4(
    world.x / uArena.x * 2.0 - 1.0,
    1.0 - world.y / uArena.y * 2.0,
    0.0,
    1.0
  );
}`;

export const SHAPE_FRAGMENT = `#version 300 es
precision highp float;
in vec2 vWorld;
flat in vec4 vRect;
flat in vec4 vColor;
flat in vec4 vColor2;
flat in vec4 vExtra;
out vec4 outColor;

vec3 unpackRgb(float packed) {
  float r = floor(packed / 65536.0);
  float g = floor((packed - r * 65536.0) / 256.0);
  float b = packed - r * 65536.0 - g * 256.0;
  return vec3(r, g, b) / 255.0;
}

/** How much of an ellipse inscribed in the rect covers the fragment. */
float ellipseCoverage(vec2 q, vec2 radii, out vec2 unit) {
  unit = q / radii;
  float r = length(unit);
  float aa = fwidth(r);
  return 1.0 - smoothstep(1.0 - aa, 1.0 + aa, r);
}

void main() {
  int kind = int(vExtra.x + 0.5);
  vec4 color = vColor;
  vec2 center = vRect.xy + vRect.zw * 0.5;

  if (kind == 1) {
    // Hazard stripes, laid in arena space - a sliding wall moves under them.
    vec2 cell = floor(vWorld);
    float tile = vExtra.y;
    if (mod(cell.x + cell.y, tile) < tile * 0.5) {
      color.rgb = mix(vColor.rgb, vColor2.rgb, vColor2.a);
    }
  } else if (kind == 2) {
    vec2 fromEdge = min(vWorld - vRect.xy, vRect.xy + vRect.zw - vWorld);
    if (min(fromEdge.x, fromEdge.y) >= 1.0) {
      discard;
    }
  } else if (kind == 3) {
    float dist = length(vWorld - center);
    float aa = fwidth(dist);
    float halfWidth = vExtra.z * 0.5;
    color.a *= 1.0 - smoothstep(halfWidth - aa, halfWidth + aa, abs(dist - vExtra.y));
  } else if (kind == 4 || kind == 5) {
    vec2 q = vWorld - center;
    if (kind == 4) {
      float s = sin(-vExtra.y);
      float c = cos(-vExtra.y);
      q = vec2(c * q.x - s * q.y, s * q.x + c * q.y);
    }
    vec2 unit;
    color.a *= ellipseCoverage(q, vRect.zw * 0.5, unit);
    if (kind == 5) {
      // A radial gradient from a light spot at the top left to a dark rim.
      vec2 focal = vec2(-0.35, -0.4);
      float t = clamp(length(unit - focal) / 1.25, 0.0, 1.0);
      vec3 dark = unpackRgb(vExtra.y);
      color.rgb = t < 0.55
        ? mix(vColor2.rgb, vColor.rgb, t / 0.55)
        : mix(vColor.rgb, dark, (t - 0.55) / 0.45);
    }
  }

  if (color.a <= 0.0) {
    discard;
  }
  outColor = color;
}`;
