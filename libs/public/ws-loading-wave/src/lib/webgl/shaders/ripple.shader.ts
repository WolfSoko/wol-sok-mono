import type { LoadingWaveShader } from '../loading-wave-shader';

/**
 * The default look on the GPU: the wave as a ripple running through water
 * over the dot grid. The crests (front and echo) are a height field; the
 * dots are seen through its slope (refraction), shaded as small beads lit
 * from the crest ahead of them, and bloom in the accent colour; the water
 * itself shows as a faint body with a glossy sheen on the crests' slopes.
 * Drawn over the host's background, so it reads in light and dark themes.
 */
export const rippleShader: LoadingWaveShader = {
  fragment: `
const float RIPPLE_GROWTH = 1.4;
const float GLOW_ALPHA = 0.18;
const float GLOW_SPACINGS = 0.18;
const float BLOOM_ALPHA = 0.08;
const float BLOOM_SPACINGS = 0.55;
const float REFRACTION = 2.0;
const float BODY_ALPHA = 0.05;
const float SHEEN_ALPHA = 0.35;
const float GLINT_ALPHA = 0.9;

/* the water's height: a crest of 1 behind the front, a lower one behind the echo */
float rippleHeight(vec2 p) {
  return ws_wave * (ws_frontGlow(ws_behindFront(p))
    + WS_ECHO_STRENGTH * ws_frontGlow(ws_behindEcho(p)));
}

/* the height's slope along the wave's direction, per CSS pixel */
float rippleSlope(vec2 p, vec2 direction) {
  return 0.5 * (rippleHeight(p + direction) - rippleHeight(p - direction));
}

/* the unit vector from the wave's centre towards p */
vec2 outwardAt(vec2 p) {
  vec2 outward = p - ws_center;
  return outward / max(length(outward), 1.0e-3);
}

vec4 wsShade(vec2 point) {
  vec3 color = vec3(0.0);
  float alpha = 0.0;
  vec2 cell = ws_cell(point);
  float glowWidth = GLOW_SPACINGS * ws_spacing;
  float bloomWidth = BLOOM_SPACINGS * ws_spacing;
  for (int row = -1; row <= 1; row++) {
    for (int column = -1; column <= 1; column++) {
      vec2 center = ws_cellCenter(cell + vec2(float(column), float(row)));
      if (any(lessThan(center, vec2(0.0))) || any(greaterThanEqual(center, ws_size))) {
        continue;
      }
      vec2 direction = outwardAt(center);
      float crest = clamp(rippleHeight(center), 0.0, 1.0);
      float lit = clamp(max(crest, ws_waveIntensity(center)), 0.0, 1.0);
      // seen through the ripple's slope, the dot shifts
      float slope = clamp(rippleSlope(center, direction) * ws_falloff, -1.0, 1.0);
      vec2 dotCenter = center - direction * REFRACTION * ws_maxPush * slope;
      float radius = 0.5 * ws_dotSize * (1.0 + RIPPLE_GROWTH * lit);
      float core = ws_dotDisk(point, dotCenter, radius);
      // a bead: a small sphere lit from the crest ahead of it
      vec2 local = (point - dotCenter) / radius;
      vec3 normal = vec3(local, sqrt(max(0.0, 1.0 - dot(local, local))));
      vec3 light = normalize(vec3(direction * 0.8, 0.6));
      float diffuse = max(dot(normal, light), 0.0);
      float glint = pow(max(dot(normal, normalize(light + vec3(0.0, 0.0, 1.0))), 0.0), 18.0);
      vec4 ink = ws_ink(lit);
      float bead = core * ink.a
        * (WS_REST_ALPHA + (WS_LIT_ALPHA - WS_REST_ALPHA) * lit)
        * mix(1.0, 0.45 + 0.75 * diffuse, lit);
      color += ink.rgb * bead;
      alpha += bead;
      float shine = core * lit * glint * GLINT_ALPHA * ws_accent.a;
      color += mix(ws_accent.rgb, vec3(1.0), 0.35) * shine;
      alpha += shine;
      // only the crests bloom, the afterglow stays calm
      float fromDot = length(point - dotCenter);
      float glow = ws_accent.a * crest * (
        GLOW_ALPHA * exp(-fromDot * fromDot / (2.0 * glowWidth * glowWidth))
        + BLOOM_ALPHA * crest * exp(-fromDot * fromDot / (2.0 * bloomWidth * bloomWidth)));
      color += ws_accent.rgb * glow;
      alpha += glow;
    }
  }
  // the water: a faint body and a glossy sheen where a crest's slope faces the light
  vec2 direction = outwardAt(point);
  float height = rippleHeight(point);
  float slope = rippleSlope(point, direction) * ws_falloff;
  vec3 surface = normalize(vec3(-direction * slope * 0.8, 1.0));
  vec3 sun = normalize(vec3(-0.45, -0.55, 0.7));
  float sheen = pow(max(dot(surface, normalize(sun + vec3(0.0, 0.0, 1.0))), 0.0), 60.0);
  float fromMiddle = (point.y - ws_center.y) / max(0.5 * ws_size.y, 1.0);
  float middle = 1.0 - 0.5 * fromMiddle * fromMiddle;
  float water = ws_accent.a * middle
    * (BODY_ALPHA * height + SHEEN_ALPHA * sheen * smoothstep(0.0, 0.2, height));
  color += ws_accent.rgb * water;
  alpha += water;
  // a soft crest line where the hairline of the 2D canvas runs
  float behind = ws_behindFront(point) / max(ws_rise, ws_pixel);
  float crestLine = ws_accent.a * WS_FRONT_LINE_ALPHA * ws_wave * exp(-behind * behind);
  color += ws_accent.rgb * crestLine;
  alpha += crestLine;
  return alpha <= 0.0 ? vec4(0.0) : vec4(color / alpha, min(alpha, 1.0));
}
`,
};
