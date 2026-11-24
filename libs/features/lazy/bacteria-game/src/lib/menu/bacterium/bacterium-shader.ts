import { CELL_SCALE } from './bacterium-items';
import { MAX_FLAGELLA } from './bacterium-look';

/** The most lobes the shader draws: every item but the nucleus. */
export const MAX_LOBES = 9;

/** How far each flagellum turns about the long axis from the first. */
const FLAGELLUM_TURNS = Array.from({ length: MAX_FLAGELLA }, (_, i) => {
  const angle = i * 2.1;
  return `vec2(${Math.cos(angle).toFixed(5)}, ${Math.sin(angle).toFixed(5)})`;
}).join(', ');

/** A triangle covering the canvas; the fragment shader does the rest. */
export const BACTERIUM_VERTEX = `#version 300 es
layout(location = 0) in vec2 aCorner;
out vec2 vUv;
void main() {
  vUv = aCorner;
  gl_Position = vec4(aCorner, 0.0, 1.0);
}
`;

/**
 * The cell (#3194), raymarched as a signed distance field in an
 * orthographic view, so a point of the box lies over the same point of the
 * cell however it turns. The canvas reaches past the box (`vUv` -1 to 1 is
 * `CELL_SCALE` times the box, #3240) and fades out at its edge, so neither
 * the flagella nor the glow end in a straight line. The cell is a
 * capsule body that breathes, the menu's lobes smoothly joined to it at
 * the anchors the buttons sit on, and what the player's rank adds - pili
 * round the membrane, flagella from the poles, thinning to their tips,
 * organelles glowing through. The body turns about its
 * long axis by `uTurn` (its cosine and sine, the same for every pixel of
 * a frame); the lobes stay put under their buttons. The lobe `uHot` names
 * swells by `uHotSwell` and lights up (-1 none, `MAX_LOBES` the nucleus,
 * which glows brighter). A lobe whose `w` is 1 is ready: its part's DNA
 * buys something, and it glows gold.
 */
export const BACTERIUM_FRAGMENT = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 outColor;

uniform float uAspect;
uniform float uTime;
uniform vec2 uTurn;
uniform float uHotSwell;
uniform vec4 uLobes[${MAX_LOBES}];
uniform int uLobeCount;
uniform int uHot;
uniform float uFlagella;
uniform float uPili;
uniform float uOrganelles;
uniform float uGlow;
uniform float uWobble;
uniform vec3 uBody;
uniform vec3 uRim;

// The canvas in the box's size, and how much of it fades out at its edge.
const float CELL_SCALE = ${CELL_SCALE.toFixed(5)};
const float EDGE_FADE = 0.08;
const float HALF_LENGTH = 0.42;
const float RADIUS = 0.5;
const int STEPS = 56;
// The rays start just in front of the cell, which stays within 0.62 of the
// box's plane, and end as far behind it: a ray missing the cell, as in the
// canvas's bleed (#3240), takes few steps.
const float RAY_START = 0.8;
// The game's gold (--bw-gold, 233 185 73) and its pulse, 2 pi in 1.8 s.
const vec3 GOLD = vec3(0.914, 0.725, 0.286);
const float READY_PULSE = 3.49;
const vec2 FLAGELLUM_TURNS[${MAX_FLAGELLA}] = vec2[${MAX_FLAGELLA}](${FLAGELLUM_TURNS});

float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

/** p turned about the x axis by the angle whose cosine and sine are cs. */
vec3 turnX(vec3 p, vec2 cs) {
  return vec3(p.x, cs.x * p.y - cs.y * p.z, cs.y * p.y + cs.x * p.z);
}

float body(vec3 p) {
  vec3 q = p;
  q.x -= clamp(q.x, -HALF_LENGTH, HALF_LENGTH);
  float breath = uWobble * sin(3.1 * p.x + uTime * 1.3) * sin(2.3 * p.y - uTime);
  return length(q) - RADIUS - breath;
}

float pili(vec3 turned) {
  if (uPili < 1.0) {
    return 0.0;
  }
  float around = atan(turned.z, turned.y);
  float spikes = sin(around * uPili) * sin(turned.x * uPili * 0.9);
  return 0.035 * pow(max(spikes, 0.0), 10.0);
}

float flagella(vec3 turned) {
  float best = 10.0;
  for (int i = 0; i < ${MAX_FLAGELLA}; i++) {
    if (float(i) >= uFlagella) {
      break;
    }
    float side = mod(float(i), 2.0) < 1.0 ? 1.0 : -1.0;
    vec3 q = turnX(turned, FLAGELLUM_TURNS[i]);
    q.x *= side;
    float along = clamp((q.x - 0.78) / 0.55, 0.0, 1.0);
    float wave = 0.07 * along * sin(10.0 * q.x - uTime * 5.0 + float(i));
    // Thinning to a point at its tip (#3240), not cut off at full width.
    float tip = 1.0 - smoothstep(0.7, 1.0, along);
    float tube = length(vec2(q.y - 0.22 - 0.25 * along - wave, q.z))
      - 0.03 * (1.0 - 0.6 * along) * tip;
    best = min(best, max(tube, abs(q.x - 1.06) - 0.29));
  }
  return best;
}

float lobes(vec3 p) {
  float best = 10.0;
  for (int i = 0; i < ${MAX_LOBES}; i++) {
    if (i >= uLobeCount) {
      break;
    }
    vec4 lobe = uLobes[i];
    float swell = i == uHot ? uHotSwell : 1.0;
    vec3 centre = vec3(lobe.x * uAspect, lobe.y, 0.12);
    best = min(best, length(p - centre) - lobe.z * swell);
  }
  return best;
}

float cell(vec3 p) {
  vec3 turned = turnX(p, uTurn);
  float d = body(p) - pili(turned);
  d = smin(d, lobes(p), 0.14);
  return min(d, flagella(turned));
}

vec3 normalAt(vec3 p) {
  const vec2 e = vec2(0.002, -0.002);
  return normalize(
    e.xyy * cell(p + e.xyy) + e.yyx * cell(p + e.yyx) +
    e.yxy * cell(p + e.yxy) + e.xxx * cell(p + e.xxx));
}

/** The organelles' light reaching the membrane at p. */
float organelleGlow(vec3 p) {
  vec3 turned = turnX(p * 1.15, uTurn);
  float sum = 0.0;
  for (int i = 0; i < 8; i++) {
    if (float(i) >= uOrganelles) {
      break;
    }
    float f = float(i);
    vec3 at = vec3(sin(f * 2.4) * 0.45, cos(f * 1.7) * 0.22, sin(f * 3.1) * 0.22);
    sum += exp(-length(turned - at) * 9.0);
  }
  return sum;
}

/**
 * The gold light of the lobes whose part's DNA buys something (\`w\` 1),
 * pulsing like the old tiles did, every 1.8 s; still at time 0.
 */
vec3 readyGlow(vec2 at) {
  float pulse = 0.75 + 0.25 * sin(uTime * READY_PULSE);
  vec3 sum = vec3(0.0);
  for (int i = 0; i < ${MAX_LOBES}; i++) {
    if (i >= uLobeCount) {
      break;
    }
    vec4 lobe = uLobes[i];
    if (lobe.w < 0.5) {
      continue;
    }
    float away = length(at - vec2(lobe.x * uAspect, lobe.y));
    sum += GOLD * 0.75 * pulse * (1.0 - smoothstep(lobe.z * 0.3, lobe.z * 1.4, away));
  }
  return sum;
}

/** 1 inside the canvas, falling to 0 over its last EDGE_FADE. */
float edgeFade() {
  vec2 inside = 1.0 - abs(vUv);
  return smoothstep(0.0, EDGE_FADE, min(inside.x, inside.y));
}

void main() {
  vec2 box = vUv * CELL_SCALE;
  vec3 origin = vec3(box.x * uAspect, box.y, RAY_START);
  vec3 ray = vec3(0.0, 0.0, -1.0);
  float travelled = 0.0;
  float closest = 10.0;
  bool hit = false;
  for (int i = 0; i < STEPS; i++) {
    float d = cell(origin + ray * travelled);
    closest = min(closest, d);
    if (d < 0.002) {
      hit = true;
      break;
    }
    travelled += d * 0.8;
    if (travelled > 2.0 * RAY_START) {
      break;
    }
  }
  float halo = uGlow * 0.45 * exp(-max(closest, 0.0) * 18.0);
  if (!hit) {
    outColor = vec4(uRim * halo, halo) * edgeFade();
    return;
  }
  vec3 p = origin + ray * travelled;
  vec3 n = normalAt(p);
  vec3 light = normalize(vec3(-0.5, 0.7, 0.8));
  float diffuse = 0.35 + 0.65 * max(dot(n, light), 0.0);
  float rim = pow(1.0 - max(n.z, 0.0), 2.4);
  float shine = pow(max(dot(reflect(-light, n), vec3(0.0, 0.0, 1.0)), 0.0), 28.0);
  float nucleus = exp(-length(p.xy) * 3.2) * (uHot == ${MAX_LOBES} ? 1.4 : 0.8);
  vec3 colour = uBody * diffuse;
  colour += uRim * (rim * (0.35 + uGlow) + organelleGlow(p) * 0.5 + nucleus * 0.5);
  colour += vec3(0.9) * shine * 0.5;
  colour += readyGlow(p.xy);
  if (uHot >= 0 && uHot < uLobeCount) {
    vec4 hot = uLobes[uHot];
    float away = length(p.xy - vec2(hot.x * uAspect, hot.y));
    colour += uRim * 0.6 * (1.0 - smoothstep(hot.z * 0.5, hot.z * 1.6, away));
  }
  outColor = vec4(colour, 1.0) * edgeFade();
}
`;
