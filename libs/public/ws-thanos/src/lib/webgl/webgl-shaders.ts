import { MIN_PARTICLE_ALPHA } from '../particles';
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

const IS_VISIBLE_INSIDE = /* glsl */ `
bool isVisibleInside(vec2 position, float alpha, vec2 size) {
  return position.x <= size.x && position.x >= 0.0 &&
    position.y <= size.y && position.y >= 0.0 &&
    alpha >= ${MIN_PARTICLE_ALPHA.toFixed(1)};
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
 * How the crumble modes crack and move an attached particle over time.
 * aCrack: shard center (xy), distance to the next coarse (z) and fine (w) crack, all in device pixels.
 */
const CRUMBLE = /* glsl */ `
const int DUST = 0;
const int CRACKS = 1;
const int SHARDS = 2;
const int CHUNKS = 3;

/** cracks get wider and finer cracks appear while the element decays */
bool isInCrack(int crumble, vec4 crack, float animationT, float pixelScale) {
  if (crumble == DUST) {
    return false;
  }
  float coarseWidth = crumble == CHUNKS
    ? 0.8 + 1.2 * smoothstep(0.0, 0.4, animationT)
    : 0.8 + 4.0 * smoothstep(0.0, 0.55, animationT);
  float fineWidth = crumble == CHUNKS
    ? 0.0
    : 2.5 * smoothstep(0.12, 0.6, animationT);
  return crack.z < coarseWidth * 0.5 * pixelScale ||
    crack.w < fineWidth * 0.5 * pixelScale;
}

/** shards slowly shift and tilt around their center */
vec2 shardOffset(int crumble, vec2 position, vec4 crack, float cellRandom, float animationT, float pixelScale) {
  if (crumble != SHARDS) {
    return vec2(0.0);
  }
  float grow = smoothstep(0.03, 0.6, animationT);
  float angle = (cellRandom - 0.5) * 0.14 * grow;
  vec2 relative = position - crack.xy;
  vec2 rotated = mat2(cos(angle), sin(angle), -sin(angle), cos(angle)) * relative;
  float direction = fract(cellRandom * 7.31) * 6.2831853;
  vec2 drift = vec2(cos(direction), sin(direction) * 0.6 - 0.4) * 5.0 * pixelScale * grow;
  return rotated - relative + drift;
}
`;

/** runs once: which shard each particle belongs to and how far it is from the next crack */
export const CRACK_VERTEX_SHADER = /* glsl */ `#version 300 es
precision highp float;
precision highp int;

layout(location = 0) in vec2 aPosition;

uniform float uCellSize;
uniform float uSeed;

out vec4 vCrack;
out float vCellRandom;

${HASH}

vec2 cellRandom(vec2 cell, uint salt) {
  uvec2 c = uvec2(ivec2(cell) + 32768);
  uint h = hash(c.x ^ hash(c.y ^ hash(floatBitsToUint(uSeed) ^ salt)));
  return vec2(toUnit(h), toUnit(hash(h)));
}

/** voronoi cell of p: center (xy), distance to the cell border (z), random (w), in cell units */
vec4 voronoi(vec2 p, uint salt) {
  vec2 n = floor(p);
  vec2 f = fract(p);
  vec2 nearestCell = vec2(0.0);
  vec2 nearest = vec2(0.0);
  float nearestDistance = 8.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 r = g + cellRandom(n + g, salt) - f;
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
      vec2 r = g + cellRandom(n + g, salt) - f;
      vec2 between = r - nearest;
      if (dot(between, between) > 0.00001) {
        border = min(border, dot(0.5 * (nearest + r), normalize(between)));
      }
    }
  }
  return vec4(p + nearest, border, cellRandom(n + nearestCell, salt + 7u).x);
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

layout(location = 0) in vec2 aPosition;
layout(location = 1) in vec2 aVelocity;
layout(location = 2) in vec2 aAcceleration;
layout(location = 3) in float aAlpha;
layout(location = 5) in float aReleasedAt;
layout(location = 6) in vec4 aCrack;
layout(location = 7) in float aCellRandom;

uniform vec2 uSize;
uniform float uDeltaTSec;
uniform float uAnimationT;
uniform float uMaxParticleX;
uniform float uMinParticleY;
uniform float uParticleAcceleration;
uniform float uSeed;
uniform int uCrumble;
uniform float uPixelScale;

out vec2 vPosition;
out vec2 vVelocity;
out vec2 vAcceleration;
out float vAlpha;
/** 0 while attached, < 0 while a chunk falls, > 0 once it is dust */
out float vReleasedAt;

const float PI = 3.141592653589793;
const float NOISE_FREQUENCY = 0.01;
/** part of the animation a chunk falls before it crumbles */
const float CHUNK_LIFE = 0.12;
/** weak, the effect canvas ends at the bottom of the element, so chunks jump up and arc */
const float CHUNK_GRAVITY = 4.0;

${IS_VISIBLE_INSIDE}
${SIMPLEX_NOISE_3D}
${HASH}
${CRUMBLE}

/** simplex noise mapped to [0, 1] like SimplexNoise({ min: 0 }) */
float noise01(vec3 position) {
  return snoise(position * NOISE_FREQUENCY) * 0.5 + 0.5;
}

/** random number in [0, 1] per particle, frame and salt */
float random(uint salt) {
  uint frame = floatBitsToUint(uAnimationT) ^ floatBitsToUint(uSeed);
  return toUnit(hash(uint(gl_VertexID) ^ hash(frame ^ salt)));
}

/** has the vaporizing front passed this position */
bool isBehindFront(vec2 position) {
  // the time is used to calculate the vaporization front
  float time = sin(uAnimationT * (PI / 2.0)) * 1.1;
  float startAccelerateX = uMaxParticleX - time * uMaxParticleX;
  float startAccelerateY = time * (uSize.y - uMinParticleY) + uMinParticleY;
  float lengthY = uSize.y - startAccelerateY;
  float accelerateRadiusPow = startAccelerateX * startAccelerateX + lengthY * lengthY;

  // some random looking functions give the vaporizing front a frayed edge.
  // no tan(): its poles would break off whole rows and columns at once
  float pXLength = position.x;
  float pYLength = uSize.y - position.y;
  pXLength += mod(position.x, uDeltaTSec) * 0.5;
  pXLength += sin((pXLength / 30.0 + 723.394) * time + uSeed * 12.5) * 11.0;
  pYLength += cos((pYLength / 100.0 + 2323.234) * time + uSeed * 456.1) * 23.0;

  return pXLength * pXLength + pYLength * pYLength > accelerateRadiusPow;
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

  vec2 dustAcceleration = vec2(random(1u), -random(2u));
  float releaseT = max(uAnimationT, 0.0001);

  if (aReleasedAt == 0.0) {
    bool inCrack = isInCrack(uCrumble, aCrack, uAnimationT, uPixelScale);
    // chunks break off as a whole, so the shard center decides
    vec2 frontPosition = uCrumble == CHUNKS ? aCrack.xy : aPosition;

    if (inCrack) {
      // the crack crumbles to dust that trickles out gently
      vPosition += shardOffset(uCrumble, aPosition, aCrack, aCellRandom, uAnimationT, uPixelScale);
      vAcceleration = dustAcceleration * 0.3;
      vReleasedAt = releaseT;
    } else if (isBehindFront(frontPosition)) {
      vPosition += shardOffset(uCrumble, aPosition, aCrack, aCellRandom, uAnimationT, uPixelScale);
      if (uCrumble == CHUNKS) {
        // the whole chunk shares velocity and gravity, so it falls in one piece
        float side = fract(aCellRandom * 13.7) - 0.5;
        vVelocity = vec2(side * 90.0, -60.0 - aCellRandom * 70.0) * uPixelScale;
        vAcceleration = vec2(0.0, CHUNK_GRAVITY);
        vReleasedAt = -releaseT;
      } else {
        vAcceleration = dustAcceleration;
        vReleasedAt = releaseT;
      }
    }
  } else if (aReleasedAt < 0.0) {
    // a falling chunk crumbles to dust after a while
    if (uAnimationT + aReleasedAt > CHUNK_LIFE + aCellRandom * 0.08) {
      vAcceleration = dustAcceleration;
      vReleasedAt = releaseT;
    }
  } else {
    // flow along the noise velocity field
    vAcceleration += vec2(
      noise01(vec3(aPosition.x, aPosition.y, uSeed + 33.23)),
      -noise01(vec3(aPosition.x, uSeed / 13.23, aPosition.y))
    );
  }

  vVelocity += vAcceleration * uParticleAcceleration * uDeltaTSec;
  vPosition += vVelocity * uDeltaTSec;
  // fade particle out (very late)
  vAlpha *= 1.0 - pow(uAnimationT, 15.0);
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

layout(location = 0) in vec2 aPosition;
layout(location = 3) in float aAlpha;
layout(location = 4) in vec4 aColor;
layout(location = 5) in float aReleasedAt;
layout(location = 6) in vec4 aCrack;
layout(location = 7) in float aCellRandom;

uniform vec2 uSize;
uniform int uCrumble;
uniform float uAnimationT;
uniform float uPixelScale;

out vec4 vColor;

${IS_VISIBLE_INSIDE}
${CRUMBLE}

void main() {
  vec2 position = aPosition;
  if (aReleasedAt == 0.0) {
    // attached shards shift and tilt before they break off
    position += shardOffset(uCrumble, aPosition, aCrack, aCellRandom, uAnimationT, uPixelScale);
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
