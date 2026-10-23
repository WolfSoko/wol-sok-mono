/**
 * The GLSL of the WebGL2 arena painter. All passes draw in arena cells:
 * `p` below is a position in cells with the origin at the top left, the
 * same coordinates the simulation uses. The canvas shows `uView` of the
 * arena - x, y, width and height in cells - all of it on a base map.
 */

import {
  glslFloat,
  LOSER_SHIFT,
  MAX_GPU_COLONIES,
  RECORD_MASK,
} from '../../gl/simulation-shaders';
import { LOOK_TUNING, LOOKS } from '../colony-renderer';

/** The looks' tuning and their `uLook` values, as GLSL constants. */
const LOOK_CONSTANTS = [
  ...Object.entries(LOOK_TUNING).map(
    ([name, value]) => `const float ${name} = ${glslFloat(value)};`
  ),
  'const vec2 CELL_FOCAL = vec2(CELL_FOCAL_X, CELL_FOCAL_Y);',
  ...Object.entries(LOOKS).map(
    ([look, { glIndex }]) =>
      `const int LOOK_${look.toUpperCase()} = ${glIndex};`
  ),
].join('\n');

/** The arena position under a fragment of a full screen pass. */
const ARENA_POSITION = `
uniform vec4 uView;
vec2 arenaPosition(vec2 ndc) {
  return uView.xy + vec2(ndc.x + 1.0, 1.0 - ndc.y) * 0.5 * uView.zw;
}`;

/** A cheap integer hash, for sparkles that look random - and as 0 to 1. */
const HASH = `
uint hash(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z;
  v.y += v.z * v.x;
  v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z;
  return v.x;
}

float hash01(uvec3 v) {
  return float(hash(v)) / 4294967295.0;
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
    ivec2(floor(arenaPosition(vNdc))),
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
 * One colony in one look - `uLook` the look's `glIndex` in {@link LOOKS},
 * the numbers of every look from {@link LOOK_TUNING}, as `LOOK_CONSTANTS`.
 *
 * Slime: the blurred density is sampled with linear filtering, so the
 * outline where it crosses the threshold is a smooth curve at full canvas
 * resolution. A dark rim sits just inside it, a gloss where the surface
 * faces the light, white heat where the colony is overcharged - and while
 * it is boosted, waves of light rush across it towards its crosshair with a
 * sparkle here and there.
 *
 * Cells: the slime's outline as a dark base, and on it glossy round cells
 * on a jittered hex lattice, each lit from the top left with a dark rim,
 * as on the app icon. A cell grows with the density under its centre, so
 * the cells are small along the front and big inside - the lattice of
 * `paintCells` in colony-renderer.ts, `uUnit` base cells apart, and
 * `uPixel` arena cells per canvas pixel for the anti-aliasing of its rims.
 * Heat and the boost light the cells up like the slime.
 *
 * Honeycomb and crystal: the colony tiled, every fragment to the nearest
 * point of a hex lattice - regular for the honeycomb, jittered for the
 * crystal - wherever the density under the tile's centre suffices, over the
 * same dark base. The honeycomb's tiles are glossy with dark seams, the
 * crystal's facets flat in their own shades with bright seams. See
 * `paintTiles` in colony-renderer.ts.
 *
 * Neon: the slime's outline as a glowing line in the colony's colour, a
 * fainter line further in, a soft halo outside and a dark body between -
 * `paintNeon`.
 *
 * Ink: a flat body hatched along `uHatch.xy`, crossed where the colony is
 * thin or everywhere for `uHatch.z` - the colony's own pattern - inside a
 * thick outline of ink - `paintInk`.
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
uniform float uPixel;
uniform vec3 uHatch;
out vec4 outColor;
${ARENA_POSITION}

const float EDGE_START = 0.07;
const float EDGE_END = 0.17;
const vec2 LIGHT = vec2(-0.6, -0.8);
${LOOK_CONSTANTS}

// Crests closing in on the crosshair - see shimmerAt in colony-renderer.ts.
float shimmer(vec2 p, float t) {
  float distance = length(p - uBoostTarget) / uUnit;
  float wave = 0.5 + 0.5 * sin(t * 9.0 + distance * 0.35);
  float squared = wave * wave;
  return squared * squared * squared;
}

${HASH}

bool sparkle(vec2 p, float t) {
  return hash01(uvec3(uvec2(floor(p)), uint(floor(t * 10.0)))) > 0.992;
}

// The white a fragment burns with: the look's own, the heat of an
// overcharged colony and, while it is boosted, the waves and sparkles.
float burn(vec2 p, float white, float heat) {
  white = max(white, heat);
  if (uShimmer >= 0.0) {
    white = max(white, shimmer(p, uShimmer) * 0.8);
    if (sparkle(p * 2.0, uShimmer)) {
      white = 1.0;
    }
  }
  return white;
}

float hash01(ivec2 lattice, uint salt) {
  return hash01(uvec3(uvec2(lattice), salt));
}

// A look's colour over the dark base of the lattice looks, with the alpha
// of both - see overBase in colony-renderer.ts.
vec4 overBase(vec3 face, float alpha, float baseAlpha) {
  float total = alpha + baseAlpha * (1.0 - alpha);
  vec3 base = uColor * CELL_BASE;
  return total > 0.0
    ? vec4((face * alpha + base * baseAlpha * (1.0 - alpha)) / total, total)
    : vec4(0.0);
}

float latticeOffset(int row, float spacing) {
  return (row & 1) == 1 ? spacing * 0.5 : 0.0;
}

// The cell of a lattice point: its centre and its radius, 0 for none - see
// cellBubble in colony-renderer.ts.
vec3 cellBubble(ivec2 lattice, float spacing) {
  float rowHeight = spacing * CELL_ROW_HEIGHT;
  vec2 centre = vec2(
    (float(lattice.x) + 0.5) * spacing + latticeOffset(lattice.y, spacing)
      + (hash01(lattice, 1u) - 0.5) * spacing * CELL_JITTER,
    (float(lattice.y) + 0.5) * rowHeight
      + (hash01(lattice, 2u) - 0.5) * rowHeight * CELL_JITTER
  );
  float d = textureLod(uDensity, centre / uArena, 0.0).r;
  if (d < CELL_MIN) {
    return vec3(centre, 0.0);
  }
  float size = (0.5 + 0.5 * clamp((d - CELL_SIZE_FROM) / CELL_SIZE_RANGE, 0.0, 1.0))
    * smoothstep(CELL_MIN, CELL_MIN + CELL_GROW, d);
  float radius = spacing * CELL_RADIUS * size
    * (CELL_RADIUS_MIN + CELL_RADIUS_VARY * hash01(lattice, 3u));
  return vec3(centre, radius);
}

// The gradient of the icon's cells on a unit disc: a light spot at the top
// left, the body colour around it and a dark rim.
vec3 sphereShade(vec2 unit) {
  float t = clamp(length(unit - CELL_FOCAL) / SPHERE_REACH, 0.0, 1.0);
  vec3 light = mix(uColor, vec3(1.0), TINT_LIGHT);
  vec3 dark = mix(uColor, vec3(0.0), TINT_DARK);
  return t < SPHERE_BODY_STOP
    ? mix(light, uColor, t / SPHERE_BODY_STOP)
    : mix(uColor, dark, (t - SPHERE_BODY_STOP) / (1.0 - SPHERE_BODY_STOP));
}

// The cells look at p: the colour of the base or of the cell the fragment
// is deepest in, and its alpha - d is the density under the fragment.
vec4 cellsLook(vec2 p, float d) {
  if (d < CELL_CLIP_START) {
    return vec4(0.0);
  }
  float spacing = CELL_SPACING * uUnit;
  float rowHeight = spacing * CELL_ROW_HEIGHT;
  int row = int(floor(p.y / rowHeight));
  float bestQ2 = 1e9;
  float bestRadius = 0.0;
  vec2 unit = vec2(0.0);
  for (int dr = -1; dr <= 1; dr++) {
    int candidateRow = row + dr;
    int col = int(floor((p.x - latticeOffset(candidateRow, spacing)) / spacing));
    for (int dc = -1; dc <= 1; dc++) {
      vec3 bubble = cellBubble(ivec2(col + dc, candidateRow), spacing);
      if (bubble.z <= 0.0) {
        continue;
      }
      vec2 v = (p - bubble.xy) / bubble.z;
      float q2 = dot(v, v);
      if (q2 < bestQ2) {
        bestQ2 = q2;
        bestRadius = bubble.z;
        unit = v;
      }
    }
  }

  float baseAlpha = BASE_ALPHA * smoothstep(EDGE_START, EDGE_END, d);
  // Anti-aliased at the rim, one canvas pixel wide.
  float cellAlpha = bestRadius > 0.0
    ? clamp((1.0 - sqrt(bestQ2)) * bestRadius / uPixel + 0.5, 0.0, 1.0)
      * smoothstep(CELL_CLIP_START, CELL_CLIP_END, d)
    : 0.0;
  vec3 face = cellAlpha > 0.0 ? sphereShade(unit) : vec3(0.0);
  return overBase(face, cellAlpha, baseAlpha);
}

// The tile of a lattice point for the honeycomb or the crystal: its centre
// and the density under it - see latticeTile in colony-renderer.ts.
vec3 latticeTile(ivec2 lattice, float spacing, bool crystal) {
  float rowHeight = spacing * CELL_ROW_HEIGHT;
  vec2 centre = vec2(
    (float(lattice.x) + 0.5) * spacing + latticeOffset(lattice.y, spacing),
    (float(lattice.y) + 0.5) * rowHeight
  );
  if (crystal) {
    centre += vec2(
      (hash01(lattice, 4u) - 0.5) * spacing,
      (hash01(lattice, 5u) - 0.5) * rowHeight
    ) * CRYSTAL_JITTER * 2.0;
  }
  return vec3(centre, textureLod(uDensity, centre / uArena, 0.0).r);
}

// The honeycomb or the crystal look at p - see paintTiles.
vec4 tilesLook(vec2 p, float d, bool crystal) {
  if (d < CELL_CLIP_START) {
    return vec4(0.0);
  }
  float spacing = TILE_SPACING * uUnit;
  float rowHeight = spacing * CELL_ROW_HEIGHT;
  int row = int(floor(p.y / rowHeight));
  // The nearest tile centre and the second nearest - the seam lies where
  // they are as far away.
  float nearest2 = 1e9;
  float second2 = 1e9;
  vec3 tile = vec3(0.0);
  ivec2 at = ivec2(0);
  for (int dr = -1; dr <= 1; dr++) {
    int candidateRow = row + dr;
    int col = int(floor((p.x - latticeOffset(candidateRow, spacing)) / spacing));
    for (int dc = -1; dc <= 1; dc++) {
      ivec2 lattice = ivec2(col + dc, candidateRow);
      vec3 candidate = latticeTile(lattice, spacing, crystal);
      vec2 v = p - candidate.xy;
      float distance2 = dot(v, v);
      if (distance2 < nearest2) {
        second2 = nearest2;
        nearest2 = distance2;
        tile = candidate;
        at = lattice;
      } else if (distance2 < second2) {
        second2 = distance2;
      }
    }
  }

  float baseAlpha = BASE_ALPHA * smoothstep(EDGE_START, EDGE_END, d);
  float tileAlpha = smoothstep(TILE_MIN, TILE_MIN + TILE_FADE, tile.z)
    * smoothstep(CELL_CLIP_START, CELL_CLIP_END, d);
  vec3 face = vec3(0.0);
  if (tileAlpha > 0.0) {
    // 0 on the seam, 1 a seam's width into the tile.
    float inside = smoothstep(0.0, TILE_SEAM, (sqrt(second2) - sqrt(nearest2)) / spacing);
    if (crystal) {
      float shade = CRYSTAL_SHADE_MIN + CRYSTAL_SHADE_VARY * hash01(at, 6u);
      face = mix(mix(uColor, vec3(1.0), TINT_LIGHT), uColor * shade, inside);
    } else {
      face = sphereShade((p - tile.xy) / (spacing * TILE_RADIUS))
        * (SEAM_DARK + (1.0 - SEAM_DARK) * inside);
    }
  }
  return overBase(face, tileAlpha, baseAlpha);
}

// The neon look at p - see paintNeon.
vec4 neonLook(float d) {
  float coverage = smoothstep(EDGE_START, EDGE_END, d);
  float line = smoothstep(NEON_LINE_START, NEON_LINE_END, d);
  float inner = smoothstep(NEON_INNER_START, NEON_INNER_END, d);
  float glow = max(line * (1.0 - line) * 4.0, inner * (1.0 - inner) * 4.0 * NEON_INNER_GLOW);
  float halo = smoothstep(0.0, NEON_LINE_START, d) * (1.0 - line) * NEON_HALO;
  float alpha = max(NEON_BODY_ALPHA * coverage, max(glow, halo));
  vec3 neon = mix(uColor, vec3(1.0), NEON_LIGHT);
  vec3 rgb = min(vec3(1.0), uColor * NEON_BODY * coverage + neon * glow + uColor * halo);
  return vec4(rgb, alpha);
}

bool inkStripe(float along, float spacing) {
  return fract(along / spacing) < INK_HATCH_WIDTH;
}

// The ink look at p - see paintInk.
vec4 inkLook(vec2 p, float d) {
  float coverage = smoothstep(EDGE_START, EDGE_END, d);
  if (coverage <= 0.0) {
    return vec4(0.0);
  }
  float outline = 1.0 - smoothstep(EDGE_END, INK_OUTLINE_END, d);
  float spacing = INK_HATCH_SPACING * uUnit;
  bool lined = inkStripe(dot(p, uHatch.xy), spacing)
    || ((uHatch.z > 0.5 || d < INK_CROSS_BELOW)
      && inkStripe(p.x * uHatch.y - p.y * uHatch.x, spacing));
  vec3 body = lined ? uColor * INK_HATCH : uColor;
  return vec4(mix(body, uColor * INK, outline), INK_ALPHA * coverage);
}

void main() {
  vec2 p = arenaPosition(vNdc);
  bool boosted = uShimmer >= 0.0;

  if (uLook == LOOK_PIXELS) {
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

  if (uLook != LOOK_SLIME) {
    if (density <= 0.0) {
      discard;
    }
    vec4 look = uLook == LOOK_CELLS ? cellsLook(p, density)
      : uLook == LOOK_HONEYCOMB || uLook == LOOK_CRYSTAL
        ? tilesLook(p, density, uLook == LOOK_CRYSTAL)
      : uLook == LOOK_NEON ? neonLook(density)
      : inkLook(p, density);
    if (look.a <= 0.0) {
      discard;
    }
    float white = burn(p, 0.0, min(1.0, sampled.g / max(density, 0.05)));
    outColor = vec4(look.rgb + (1.0 - look.rgb) * white, look.a * uAlpha);
    return;
  }

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
  float white = burn(p, gloss * 0.75, min(1.0, sampled.g / max(density, 0.05)));
  if (boosted) {
    shade = max(shade, 0.85 + 0.15 * shimmer(p, uShimmer));
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
  return hash01(uvec3(uvec2(cell), uint(t) * 7u + salt));
}

void main() {
  vec2 p = arenaPosition(vNdc);
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
  outColor = texture(uZones, arenaPosition(vNdc) / uArena) * uAlpha;
}`;

/** One instance per shape, its rect in arena cells - see `SHAPE`. */
export const SHAPE_VERTEX = `#version 300 es
layout(location = 0) in vec2 aCorner;
layout(location = 1) in vec4 aRect;
layout(location = 2) in vec4 aColor;
layout(location = 3) in vec4 aColor2;
layout(location = 4) in vec4 aExtra;
uniform vec4 uView;
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
  vec2 inView = (world - uView.xy) / uView.zw;
  gl_Position = vec4(inView.x * 2.0 - 1.0, 1.0 - inView.y * 2.0, 0.0, 1.0);
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
