import { MIN_PARTICLE_ALPHA } from '../particles';
import { FLOW_FIELD, FRONT_FRAY } from '../vaporizing-front';
import { WsThanosCrumble } from '../ws-thanos.options';
import { SIMPLEX_NOISE_3D } from './simplex-noise.glsl';

/** attribute locations shared by all programs */
export const AttributeLocation = {
  POSITION: 0,
  VELOCITY: 1,
  ACCELERATION: 2,
  ALPHA: 3,
  COLOR: 4,
  RELEASED_AT: 5,
  CRACK: 6,
  CELL_RANDOM: 7,
} as const;

/** crumble mode as passed to the shaders */
export const CRUMBLE_MODE: Record<WsThanosCrumble, number> = {
  dust: 0,
  cracks: 1,
  shards: 2,
  chunks: 3,
};

export const UPDATE_FEEDBACK_VARYINGS = [
  'vPosition',
  'vVelocity',
  'vAcceleration',
  'vAlpha',
  'vReleasedAt',
];

export const CRACK_FEEDBACK_VARYINGS = ['vCrack', 'vCellRandom'];

/** floats per particle written by the crack program */
export const CRACK_LENGTH = 5;

const L = AttributeLocation;

/** GLSL float literal */
const f = (value: number): string =>
  Number.isInteger(value) ? value.toFixed(1) : String(value);

const IS_VISIBLE_INSIDE = /* glsl */ `
bool isVisibleInside(vec2 position, float alpha, vec2 size) {
  return position.x <= size.x && position.x >= 0.0 &&
    position.y <= size.y && position.y >= 0.0 &&
    alpha >= ${f(MIN_PARTICLE_ALPHA)};
}
`;

const HASH = /* glsl */ `
uint hash(uint x) {
  x ^= x >> 16;
  x *= 0x7feb352du;
  x ^= x >> 15;
  x *= 0x846ca68bu;
  x ^= x >> 16;
  return x;
}

float toUnit(uint x) {
  return float(x) / 4294967295.0;
}
`;

/**
 * Shards shift and tilt around their center while uShardGrow rises.
 * aCrack: shard center (xy), distance to the next coarse (z) and fine (w) crack, in device pixels.
 */
const SHARD_OFFSET = /* glsl */ `
vec2 shardOffset(vec2 position, vec4 crack, float cellRandom) {
  if (uShardGrow == 0.0) {
    return vec2(0.0);
  }
  float angle = (cellRandom - 0.5) * 0.14 * uShardGrow;
  vec2 relative = position - crack.xy;
  vec2 rotated = mat2(cos(angle), sin(angle), -sin(angle), cos(angle)) * relative;
  float direction = fract(cellRandom * 7.31) * 6.2831853;
  vec2 drift = vec2(cos(direction), sin(direction) * 0.6 - 0.4) * 5.0 * uPixelScale * uShardGrow;
  return rotated - relative + drift;
}
`;

/** runs once: which shard each particle belongs to and how far it is from the next crack */
export const CRACK_VERTEX_SHADER = /* glsl */ `#version 300 es
precision highp float;
precision highp int;

layout(location = ${L.POSITION}) in vec2 aPosition;

uniform float uCellSize;
uniform float uSeed;

out vec4 vCrack;
out float vCellRandom;

${HASH}

vec2 cellRandom(vec2 cell, uint saltedSeed) {
  uvec2 c = uvec2(ivec2(cell) + 32768);
  uint h = hash(c.x ^ hash(c.y ^ saltedSeed));
  return vec2(toUnit(h), toUnit(hash(h)));
}

/** voronoi cell of p: center (xy), distance to the cell border (z), random (w), in cell units */
vec4 voronoi(vec2 p, uint salt) {
  uint saltedSeed = hash(floatBitsToUint(uSeed) ^ salt);
  vec2 n = floor(p);
  vec2 f = fract(p);
  vec2 nearestCell = vec2(0.0);
  vec2 nearest = vec2(0.0);
  float nearestDistance = 8.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 r = g + cellRandom(n + g, saltedSeed) - f;
      float d = dot(r, r);
      if (d < nearestDistance) {
        nearestDistance = d;
        nearest = r;
        nearestCell = g;
      }
    }
  }
  // exact distance to the border between the nearest and its neighbour cells
  float border = 8.0;
  for (int j = -2; j <= 2; j++) {
    for (int i = -2; i <= 2; i++) {
      vec2 g = nearestCell + vec2(float(i), float(j));
      vec2 r = g + cellRandom(n + g, saltedSeed) - f;
      vec2 between = r - nearest;
      if (dot(between, between) > 0.00001) {
        border = min(border, dot(0.5 * (nearest + r), normalize(between)));
      }
    }
  }
  uint randomSeed = hash(floatBitsToUint(uSeed) ^ (salt + 7u));
  return vec4(p + nearest, border, cellRandom(n + nearestCell, randomSeed).x);
}

void main() {
  vec4 coarse = voronoi(aPosition / uCellSize, 1u);
  float fineSize = uCellSize * 0.42;
  vec4 fine = voronoi(aPosition / fineSize, 2u);
  vCrack = vec4(coarse.xy * uCellSize, coarse.z * uCellSize, fine.z * fineSize);
  vCellRandom = coarse.w;
}
`;

/** moves the particles, the GPU port of updateParticlesOnCpu plus the crumble modes */
export const UPDATE_VERTEX_SHADER = /* glsl */ `#version 300 es
precision highp float;
precision highp int;

layout(location = ${L.POSITION}) in vec2 aPosition;
layout(location = ${L.VELOCITY}) in vec2 aVelocity;
layout(location = ${L.ACCELERATION}) in vec2 aAcceleration;
layout(location = ${L.ALPHA}) in float aAlpha;
layout(location = ${L.RELEASED_AT}) in float aReleasedAt;
layout(location = ${L.CRACK}) in vec4 aCrack;
layout(location = ${L.CELL_RANDOM}) in float aCellRandom;

uniform vec2 uSize;
uniform float uDeltaTSec;
uniform float uAnimationT;
uniform float uParticleAcceleration;
uniform float uSeed;
uniform int uCrumble;
uniform float uPixelScale;
/** see vaporizingFront() */
uniform float uFrontTime;
uniform float uFrontRadiusPow;
uniform float uFade;
/** see crumbleShape(), in device pixels */
uniform float uCoarseCrack;
uniform float uFineCrack;
uniform float uShardGrow;

out vec2 vPosition;
out vec2 vVelocity;
out vec2 vAcceleration;
out float vAlpha;
/** 0 while attached, < 0 while a chunk falls, > 0 once it is dust */
out float vReleasedAt;

const int CHUNKS = ${CRUMBLE_MODE.chunks};
/** part of the animation a chunk flies before it crumbles */
const float CHUNK_LIFE = 0.12;
/** weak, the effect canvas ends at the bottom of the element, so chunks jump up and arc */
const float CHUNK_GRAVITY = 4.0;

${IS_VISIBLE_INSIDE}
${SIMPLEX_NOISE_3D}
${HASH}
${SHARD_OFFSET}

/** simplex noise mapped to [0, 1] like SimplexNoise({ min: 0 }) */
float noise01(vec3 position) {
  return snoise(position * ${f(FLOW_FIELD.frequency)}) * 0.5 + 0.5;
}

/** random number in [0, 1] per particle, frame and salt */
float random(uint salt) {
  uint frame = floatBitsToUint(uAnimationT) ^ floatBitsToUint(uSeed);
  return toUnit(hash(uint(gl_VertexID) ^ hash(frame ^ salt)));
}

vec2 dustAcceleration() {
  return vec2(random(1u), -random(2u));
}

/** has the vaporizing front passed this position, see isBehindFront() */
bool isBehindFront(vec2 position) {
  float pXLength = position.x + mod(position.x, uDeltaTSec) * 0.5;
  float pYLength = uSize.y - position.y;
  pXLength += sin((pXLength / ${f(FRONT_FRAY.xWave)} + ${f(FRONT_FRAY.xPhase)}) * uFrontTime
    + uSeed * ${f(FRONT_FRAY.xSeed)}) * ${f(FRONT_FRAY.xAmplitude)};
  pYLength += cos((pYLength / ${f(FRONT_FRAY.yWave)} + ${f(FRONT_FRAY.yPhase)}) * uFrontTime
    + uSeed * ${f(FRONT_FRAY.ySeed)}) * ${f(FRONT_FRAY.yAmplitude)};
  return pXLength * pXLength + pYLength * pYLength > uFrontRadiusPow;
}

void main() {
  vPosition = aPosition;
  vVelocity = aVelocity;
  vAcceleration = aAcceleration;
  vAlpha = aAlpha;
  vReleasedAt = aReleasedAt;

  // only update particles that are inside view and visible
  if (!isVisibleInside(aPosition, aAlpha, uSize)) {
    return;
  }

  float releaseT = max(uAnimationT, 0.0001);

  if (aReleasedAt == 0.0) {
    bool inCrack = aCrack.z < uCoarseCrack || aCrack.w < uFineCrack;
    // chunks break off as a whole, so the shard center decides
    vec2 frontPosition = uCrumble == CHUNKS ? aCrack.xy : aPosition;

    if (inCrack || isBehindFront(frontPosition)) {
      vPosition += shardOffset(aPosition, aCrack, aCellRandom);
      vReleasedAt = releaseT;
      if (inCrack) {
        // the crack crumbles to dust that trickles out gently
        vAcceleration = dustAcceleration() * 0.3;
      } else if (uCrumble == CHUNKS) {
        // the whole chunk shares velocity and gravity, so it flies in one piece
        float side = fract(aCellRandom * 13.7) - 0.5;
        vVelocity = vec2(side * 90.0, -60.0 - aCellRandom * 70.0) * uPixelScale;
        vAcceleration = vec2(0.0, CHUNK_GRAVITY);
        vReleasedAt = -releaseT;
      } else {
        vAcceleration = dustAcceleration();
      }
    }
  } else if (aReleasedAt < 0.0) {
    // a flying chunk crumbles to dust after a while
    if (uAnimationT + aReleasedAt > CHUNK_LIFE + aCellRandom * 0.08) {
      vAcceleration = dustAcceleration();
      vReleasedAt = releaseT;
    }
  } else {
    // flow along the noise velocity field
    vAcceleration += vec2(
      noise01(vec3(aPosition.x, aPosition.y, uSeed + ${f(FLOW_FIELD.xSeedOffset)})),
      -noise01(vec3(aPosition.x, uSeed / ${f(FLOW_FIELD.ySeedDivisor)}, aPosition.y))
    );
  }

  vVelocity += vAcceleration * uParticleAcceleration * uDeltaTSec;
  vPosition += vVelocity * uDeltaTSec;
  vAlpha *= uFade;
}
`;

/** transform feedback only, nothing is rasterized */
export const FEEDBACK_FRAGMENT_SHADER = /* glsl */ `#version 300 es
precision mediump float;
out vec4 outColor;
void main() {
  outColor = vec4(0.0);
}
`;

/** draws every particle as one device pixel */
export const DRAW_VERTEX_SHADER = /* glsl */ `#version 300 es
precision highp float;
precision highp int;

layout(location = ${L.POSITION}) in vec2 aPosition;
layout(location = ${L.ALPHA}) in float aAlpha;
layout(location = ${L.COLOR}) in vec4 aColor;
layout(location = ${L.RELEASED_AT}) in float aReleasedAt;
layout(location = ${L.CRACK}) in vec4 aCrack;
layout(location = ${L.CELL_RANDOM}) in float aCellRandom;

uniform vec2 uSize;
uniform float uPixelScale;
uniform float uShardGrow;

out vec4 vColor;

${IS_VISIBLE_INSIDE}
${SHARD_OFFSET}

void main() {
  vec2 position = aPosition;
  if (aReleasedAt == 0.0) {
    // attached shards shift and tilt before they break off
    position += shardOffset(aPosition, aCrack, aCellRandom);
  }
  if (!isVisibleInside(position, aAlpha, uSize)) {
    // move outside of clip space
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 1.0;
    vColor = vec4(0.0);
    return;
  }
  vec2 clip = (floor(position) + 0.5) / uSize * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  gl_PointSize = 1.0;
  float alpha = aAlpha / 255.0;
  // premultiplied alpha
  vColor = vec4(aColor.rgb * alpha, alpha);
}
`;

export const DRAW_FRAGMENT_SHADER = /* glsl */ `#version 300 es
precision mediump float;
in vec4 vColor;
out vec4 outColor;
void main() {
  outColor = vColor;
}
`;
