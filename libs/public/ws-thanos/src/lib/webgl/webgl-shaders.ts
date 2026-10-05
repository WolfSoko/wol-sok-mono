import { MIN_PARTICLE_ALPHA } from '../particles';

/** attribute locations shared by both programs */
export const AttributeLocation = {
  POSITION: 0,
  VELOCITY: 1,
  ACCELERATION: 2,
  ALPHA: 3,
  COLOR: 4,
} as const;

export const TRANSFORM_FEEDBACK_VARYINGS = [
  'vPosition',
  'vVelocity',
  'vAcceleration',
  'vAlpha',
];

const IS_VISIBLE_INSIDE = /* glsl */ `
bool isVisibleInside(vec2 position, float alpha, vec2 size) {
  return position.x <= size.x && position.x >= 0.0 &&
    position.y <= size.y && position.y >= 0.0 &&
    alpha >= ${MIN_PARTICLE_ALPHA.toFixed(1)};
}
`;

/**
 * 3D simplex noise by Ian McEwan, Ashima Arts (MIT License)
 * https://github.com/ashima/webgl-noise
 */
const SIMPLEX_NOISE_3D = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 10.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);

  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;

  i = mod289(i);
  vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));

  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);

  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);

  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  vec4 m = max(0.5 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 105.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
`;

/** moves the particles, the GPU port of updateParticlesOnCpu */
export const UPDATE_VERTEX_SHADER = /* glsl */ `#version 300 es
precision highp float;
precision highp int;

layout(location = 0) in vec2 aPosition;
layout(location = 1) in vec2 aVelocity;
layout(location = 2) in vec2 aAcceleration;
layout(location = 3) in float aAlpha;

uniform vec2 uSize;
uniform float uDeltaTSec;
uniform float uAnimationT;
uniform float uMaxParticleX;
uniform float uMinParticleY;
uniform float uParticleAcceleration;
uniform float uSeed;

out vec2 vPosition;
out vec2 vVelocity;
out vec2 vAcceleration;
out float vAlpha;

const float PI = 3.141592653589793;
const float NOISE_FREQUENCY = 0.01;

${IS_VISIBLE_INSIDE}
${SIMPLEX_NOISE_3D}

/** simplex noise mapped to [0, 1] like SimplexNoise({ min: 0 }) */
float noise01(vec3 position) {
  return snoise(position * NOISE_FREQUENCY) * 0.5 + 0.5;
}

uint hash(uint x) {
  x ^= x >> 16;
  x *= 0x7feb352du;
  x ^= x >> 15;
  x *= 0x846ca68bu;
  x ^= x >> 16;
  return x;
}

/** random number in [0, 1] per particle, frame and salt */
float random(uint salt) {
  uint frame = floatBitsToUint(uAnimationT) ^ floatBitsToUint(uSeed);
  return float(hash(uint(gl_VertexID) ^ hash(frame ^ salt))) / 4294967295.0;
}

void main() {
  vPosition = aPosition;
  vVelocity = aVelocity;
  vAcceleration = aAcceleration;
  vAlpha = aAlpha;

  // only update particles that are inside view and visible
  if (!isVisibleInside(aPosition, aAlpha, uSize)) {
    return;
  }

  if (aAcceleration == vec2(0.0)) {
    // the time is used to calculate the vaporization front
    float time = sin(uAnimationT * (PI / 2.0)) * 1.1;
    float startAccelerateX = uMaxParticleX - time * uMaxParticleX;
    float startAccelerateY = time * (uSize.y - uMinParticleY) + uMinParticleY;
    float lengthY = uSize.y - startAccelerateY;
    float accelerateRadiusPow = startAccelerateX * startAccelerateX + lengthY * lengthY;

    // some random looking functions give the vaporizing front a frayed edge.
    // no tan(): its poles would break off whole rows and columns at once
    float pXLength = aPosition.x;
    float pYLength = uSize.y - aPosition.y;
    pXLength += mod(aPosition.x, uDeltaTSec) * 0.5;
    pXLength += sin((pXLength / 30.0 + 723.394) * time + uSeed * 12.5) * 11.0;
    pYLength += cos((pYLength / 100.0 + 2323.234) * time + uSeed * 456.1) * 23.0;

    if (pXLength * pXLength + pYLength * pYLength > accelerateRadiusPow) {
      vAcceleration = vec2(random(1u), -random(2u));
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
export const UPDATE_FRAGMENT_SHADER = /* glsl */ `#version 300 es
precision mediump float;
out vec4 outColor;
void main() {
  outColor = vec4(0.0);
}
`;

/** draws every particle as one device pixel */
export const DRAW_VERTEX_SHADER = /* glsl */ `#version 300 es
precision highp float;

layout(location = 0) in vec2 aPosition;
layout(location = 3) in float aAlpha;
layout(location = 4) in vec4 aColor;

uniform vec2 uSize;

out vec4 vColor;

${IS_VISIBLE_INSIDE}

void main() {
  if (!isVisibleInside(aPosition, aAlpha, uSize)) {
    // move outside of clip space
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 1.0;
    vColor = vec4(0.0);
    return;
  }
  vec2 clip = (floor(aPosition) + 0.5) / uSize * 2.0 - 1.0;
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
