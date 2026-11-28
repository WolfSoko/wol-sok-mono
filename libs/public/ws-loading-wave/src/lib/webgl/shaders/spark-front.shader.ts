import type { LoadingWaveShader } from '../loading-wave-shader';

/**
 * Electric arcs: the front is a crackling bolt, an arc thrown off the front
 * line by noise that changes several times a second, whose branches jump to
 * the dots near it. A struck dot sparks hot and keeps the afterglow. The
 * loudest of the built-in shaders.
 */
export const sparkFrontShader: LoadingWaveShader = {
  fragment: `
const float FRAMES_PER_SECOND = 14.0;
const float WANDER_SPACINGS = 0.9;
const float BOLT_WIDTH = 0.07;
const float BOLT_GLOW_SPACINGS = 0.45;
const float BOLT_GLOW_ALPHA = 0.4;
const float STRIKE_CHANCE = 0.3;
// a branch, kink and width included, stays within the 3 x 3 cells drawn
const float REACH_SPACINGS = 1.2;
const float BRANCH_KINK_SPACINGS = 0.35;
const float DOT_GROWTH = 1.0;
const float SPARK_GROWTH = 1.4;
const float SPARK_WHITENING = 0.7;
const float BRANCH_WIDTH = 0.6;
const float COARSE_WANDER_SPACINGS = 2.5;
const float FINE_WANDER_SPACINGS = 0.7;
const float FINE_WANDER_SHARE = 0.35;
const vec3 LUMA = vec3(0.299, 0.587, 0.114);
const float TAU = 6.28318530718;

/* smooth value noise along t, 0 to 1, a new curve per frame */
float frameNoise(float t, float frame) {
  float index = floor(t);
  float into = fract(t);
  float eased = into * into * (3.0 - 2.0 * into);
  return mix(ws_hash(vec2(index, frame)), ws_hash(vec2(index + 1.0, frame)), eased);
}

/* frameNoise along t that repeats every period (a whole number), so a loop has no seam */
float loopNoise(float t, float period, float frame) {
  float index = floor(t);
  float into = fract(t);
  float eased = into * into * (3.0 - 2.0 * into);
  return mix(ws_hash(vec2(mod(index, period), frame)),
    ws_hash(vec2(mod(index + 1.0, period), frame)), eased);
}

/*
 * Whether the wave grows from inside the host (origin 'center'): its bolt
 * then runs all the way around, where from the left only an arc shows.
 */
bool frontLoops() {
  return ws_center.x >= 0.0;
}

/*
 * The radius the bolt's arc lengths are measured on: the circle the front
 * starts on from the left, about its height from the middle near the front;
 * the front's own circle when it loops.
 */
float arcRadius() {
  return frontLoops() ? max(ws_frontRadius, ws_spacing) : -ws_center.x;
}

/*
 * Where p lies around the wave's centre, as an arc length on arcRadius().
 * Every point on a line from the centre has the same, so the bolt is one curve.
 */
float arcAround(vec2 p) {
  return atan(p.y - ws_center.y, p.x - ws_center.x) * arcRadius();
}

/* the noise of the bolt's wander along an arc length, in cells of cellLength, seamless where it loops */
float wanderNoise(float arc, float cellLength, float frame) {
  if (!frontLoops()) {
    return frameNoise(arc / cellLength, frame);
  }
  float around = TAU * arcRadius();
  float cells = max(1.0, floor(around / cellLength));
  return loopNoise(arc * cells / around, cells, frame);
}

/* how far the bolt lies behind the front at an arc length, in CSS pixels: a coarse and a fine wander */
float boltOffset(float arc, float frame) {
  float coarse = wanderNoise(arc, COARSE_WANDER_SPACINGS * ws_spacing, frame);
  float fine = wanderNoise(arc, FINE_WANDER_SPACINGS * ws_spacing, frame + 17.0);
  float wander = mix(coarse, fine, FINE_WANDER_SHARE);
  return WANDER_SPACINGS * ws_spacing * (2.0 * wander - 1.0);
}

/* where the bolt crosses the line from the wave's centre through p */
vec2 boltPointToward(vec2 p, float frame) {
  vec2 fromCenter = p - ws_center;
  float distance = length(fromCenter);
  // a dot right at a looping front's centre points nowhere: take any way out
  vec2 outward = distance > 0.0 ? fromCenter / distance : vec2(1.0, 0.0);
  return ws_center + outward * (ws_frontRadius - boltOffset(arcAround(p), frame));
}

/*
 * The colour a spark burns in: lighter than the accent where the dots are
 * light, so over a dark background, and the accent itself over a light one.
 */
vec3 sparkColor() {
  float dotsLight = step(0.5, dot(ws_color.rgb, LUMA));
  return mix(ws_accent.rgb, vec3(1.0), SPARK_WHITENING * dotsLight);
}

vec4 wsShade(vec2 point) {
  float frame = floor(ws_time * FRAMES_PER_SECOND);
  vec3 spark = sparkColor();

  // the bolt: its core measured across it, so its steep stretches keep their
  // width; its glow along the front, so a sharp bend throws no smear
  float arc = arcAround(point);
  float offset = boltOffset(arc, frame);
  float slope = boltOffset(arc + 0.5, frame) - boltOffset(arc - 0.5, frame);
  float along = abs(ws_behindFront(point) - offset);
  float away = along / sqrt(1.0 + slope * slope);
  float boltWidth = max(BOLT_WIDTH * ws_spacing, 1.5 * ws_pixel);
  float glowWidth = BOLT_GLOW_SPACINGS * ws_spacing;
  float bolt = ws_wave * ws_band(away, boltWidth);
  float boltGlow = ws_wave * BOLT_GLOW_ALPHA * exp(-along * along / (2.0 * glowWidth * glowWidth));

  // the dots, and the branches the bolt throws to those it strikes
  vec2 cell = ws_cell(point);
  float dots = 0.0;
  vec3 dotColor = vec3(0.0);
  float branches = 0.0;
  for (int row = -1; row <= 1; row++) {
    for (int column = -1; column <= 1; column++) {
      vec2 neighbour = cell + vec2(float(column), float(row));
      vec2 center = ws_cellCenter(neighbour);
      if (any(lessThan(center, vec2(0.0))) || any(greaterThanEqual(center, ws_size))) {
        continue;
      }
      vec2 target = boltPointToward(center, frame);
      bool inReach = length(target - center) < REACH_SPACINGS * ws_spacing;
      float struck = ws_wave * step(ws_hash(neighbour + vec2(frame * 0.37, 5.0)), STRIKE_CHANCE)
        * (inReach ? 1.0 : 0.0);
      if (struck > 0.0) {
        vec2 across = normalize(vec2(target.y - center.y, center.x - target.x) + vec2(1.0e-4));
        vec2 kink = 0.5 * (center + target)
          + across * BRANCH_KINK_SPACINGS * ws_spacing * (ws_hash(neighbour + frame) - 0.5);
        float branch = max(ws_segment(point, center, kink, BRANCH_WIDTH * boltWidth),
          ws_segment(point, kink, target, BRANCH_WIDTH * boltWidth));
        branches = max(branches, struck * branch);
      }
      float lit = ws_waveIntensity(center);
      float radius = 0.5 * ws_dotSize * (1.0 + DOT_GROWTH * lit + SPARK_GROWTH * struck);
      float core = ws_dotDisk(point, center, radius);
      vec4 ink = ws_ink(lit);
      float dotAlpha = core * ink.a * mix(WS_REST_ALPHA, WS_LIT_ALPHA, max(lit, struck));
      vec3 color = mix(ink.rgb, spark, struck);
      dotColor = dotColor * (1.0 - dotAlpha) + color * dotAlpha;
      dots = dots + (1.0 - dots) * dotAlpha;
    }
  }

  float glow = ws_accent.a * boltGlow;
  float hot = ws_accent.a * max(bolt, branches);
  vec3 color = dotColor;
  float alpha = dots;
  color = color * (1.0 - glow) + ws_accent.rgb * glow;
  alpha = alpha * (1.0 - glow) + glow;
  color = color * (1.0 - hot) + spark * hot;
  alpha = alpha * (1.0 - hot) + hot;
  return alpha <= 0.0 ? vec4(0.0) : vec4(color / alpha, alpha);
}
`,
};
