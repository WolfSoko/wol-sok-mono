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
  'const vec3 SURFACE_LIGHT = vec3(SURFACE_LIGHT_X, SURFACE_LIGHT_Y, SURFACE_LIGHT_Z);',
  ...Object.entries(LOOKS).map(
    ([look, { glIndex }]) =>
      `const int LOOK_${look.toUpperCase()} = ${glIndex};`
  ),
].join('\n');

/** The most weapons' effects that shade one colony at once. */
export const MAX_TINTS = 4;

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

/** Value noise and its fractal sum, from the hash above. */
const NOISE = `
float hash21(vec2 c) {
  return float(hash(uvec3(uvec2(ivec2(floor(c)) + 8192), 29u))) / 4294967295.0;
}
float valueNoise(vec2 x) {
  vec2 i = floor(x);
  vec2 f = fract(x);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}
float fbm(vec2 x) {
  float sum = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 3; i++) {
    sum += amplitude * valueNoise(x);
    x = x * 2.03 + 17.1;
    amplitude *= 0.5;
  }
  return sum / 0.875;
}`;

/**
 * A honeycomb: hexCell gives the position in the hexagon a point lies in
 * (xy, its centre at 0) and that hexagon's id (zw); hexEdge is 0.5 on the
 * border of a hexagon of width 1 and 0 at its centre.
 */
const HEX = `
vec4 hexCell(vec2 uv) {
  const vec2 s = vec2(1.0, 1.7320508);
  vec4 ids = floor(vec4(uv, uv - vec2(0.5, 1.0)) / s.xyxy) + 0.5;
  vec4 h = vec4(uv - ids.xy * s, uv - (ids.zw + 0.5) * s);
  return dot(h.xy, h.xy) < dot(h.zw, h.zw)
    ? vec4(h.xy, ids.xy)
    : vec4(h.zw, ids.zw + 0.5);
}
float hexEdge(vec2 p) {
  p = abs(p);
  return max(dot(p, vec2(0.5, 0.8660254)), p.x);
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
 * Bubbles: glassy bubbles of different sizes on the cells' lattice, a
 * faint film with a bright rim and a light spot, each with snippets of DNA
 * drifting and turning inside with `uTime` - `paintBubbles`.
 *
 * Marbles: glass marbles of different sizes on a lattice of their own, each
 * a sphere lit by `SURFACE_LIGHT` with a swirl of the light colour inside, a
 * dark rim, a glow where the light leaves it and a hard highlight -
 * `paintMarbles`.
 *
 * Lava: a dark crust bulging with the density, cracked along two levels of
 * a slowly flowing noise, the cracks glowing hot and breathing with `uTime`,
 * the front molten - `paintLava`.
 *
 * Galaxy: deep space in the colony's colour, clouds of gas from two noises,
 * stars on a lattice that twinkle, a bright core and a faint rim -
 * `paintGalaxy`.
 *
 * Plasma: a dark body full of arcs - the ridges of two noises moving with
 * the time, sharpened, with a halo and a flicker - and a glowing outline -
 * `paintPlasma`.
 *
 * Chrome: liquid metal, its normal from the density's slope - a bevel along
 * the front - and a ripple of noise inside, mirroring a sky in the colony's
 * colour, with the highlight and a fresnel rim - `paintChrome`.
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
uniform float uTime;
// The weapons' effects on this colony - see ColonyTint: centre, radius and
// strength, and the mode of each (0 toxin, 1 cryo, 2 shield, 3 bloom).
uniform int uTintCount;
uniform vec4 uTints[${MAX_TINTS}];
uniform vec4 uTintModes;
out vec4 outColor;
${ARENA_POSITION}

const float EDGE_START = 0.07;
const float EDGE_END = 0.17;
const vec2 LIGHT = vec2(-0.6, -0.8);
const float PI = 3.14159265;
${LOOK_CONSTANTS}

// Crests closing in on the crosshair - see shimmerAt in colony-renderer.ts.
float shimmer(vec2 p, float t) {
  float distance = length(p - uBoostTarget) / uUnit;
  float wave = 0.5 + 0.5 * sin(t * 9.0 + distance * 0.35);
  float squared = wave * wave;
  return squared * squared * squared;
}

${HASH}
${NOISE}

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
vec3 cellBubble(ivec2 lattice, vec4 cells) {
  float spacing = cells.x * uUnit;
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
  float radius = spacing * cells.y * size * (cells.z + cells.w * hash01(lattice, 3u));
  return vec3(centre, radius);
}

// The lattice of a look's cells: spacing in base cells, radius in spacings,
// varied from a share up by this much - CELLS and BUBBLES in colony-renderer.ts.
const vec4 CELLS = vec4(CELL_SPACING, CELL_RADIUS, CELL_RADIUS_MIN, CELL_RADIUS_VARY);
const vec4 BUBBLES = vec4(BUBBLE_SPACING, BUBBLE_RADIUS, BUBBLE_RADIUS_MIN, BUBBLE_RADIUS_VARY);
const vec4 MARBLES = vec4(MARBLE_SPACING, MARBLE_RADIUS, MARBLE_RADIUS_MIN, MARBLE_RADIUS_VARY);

// The cell of a lattice look the fragment is deepest in: its unit disc
// coordinates, its radius (0 for none), the square of the fragment's unit
// distance and the lattice point it sits on - see nearestBubble in
// colony-renderer.ts.
struct Bubble {
  vec2 unit;
  float radius;
  float q2;
  ivec2 lattice;
};

Bubble nearestBubble(vec2 p, vec4 cells) {
  float spacing = cells.x * uUnit;
  float rowHeight = spacing * CELL_ROW_HEIGHT;
  int row = int(floor(p.y / rowHeight));
  Bubble best = Bubble(vec2(0.0), 0.0, 1e9, ivec2(0));
  for (int dr = -1; dr <= 1; dr++) {
    int candidateRow = row + dr;
    int col = int(floor((p.x - latticeOffset(candidateRow, spacing)) / spacing));
    for (int dc = -1; dc <= 1; dc++) {
      ivec2 lattice = ivec2(col + dc, candidateRow);
      vec3 bubble = cellBubble(lattice, cells);
      if (bubble.z <= 0.0) {
        continue;
      }
      vec2 v = (p - bubble.xy) / bubble.z;
      float q2 = dot(v, v);
      if (q2 < best.q2) {
        best = Bubble(v, bubble.z, q2, lattice);
      }
    }
  }
  return best;
}

// How much of a lattice cell covers a fragment at that unit distance
// squared: anti-aliased at the rim, one canvas pixel wide, and nothing where
// the density under it is too thin for a cell to float over - cellEdge.
float cellEdge(float q2, float radius, float d) {
  return clamp((1.0 - sqrt(q2)) * radius / uPixel + 0.5, 0.0, 1.0)
    * smoothstep(CELL_CLIP_START, CELL_CLIP_END, d);
}

// The colony's colour lightened - lookPalette's light.
vec3 lightColor() {
  return mix(uColor, vec3(1.0), TINT_LIGHT);
}

// The gradient of the icon's cells on a unit disc: a light spot at the top
// left, the body colour around it and a dark rim.
vec3 sphereShade(vec2 unit) {
  float t = clamp(length(unit - CELL_FOCAL) / SPHERE_REACH, 0.0, 1.0);
  vec3 light = lightColor();
  vec3 dark = mix(uColor, vec3(0.0), TINT_DARK);
  return t < SPHERE_BODY_STOP
    ? mix(light, uColor, t / SPHERE_BODY_STOP)
    : mix(uColor, dark, (t - SPHERE_BODY_STOP) / (1.0 - SPHERE_BODY_STOP));
}

// A byte of a hash, 0 to 1 - the helices take their numbers from a hash a
// byte at a time, a hash being the costly part on a phone.
float octet(uint h, uint i) {
  return float((h >> (8u * i)) & 255u) / 255.0;
}

// How much of a DNA snippet covers a point of a bubble's unit disc - see
// layHelices and dnaAt in colony-renderer.ts. aa is a pixel's width on the
// disc.
float dnaAt(vec2 u, ivec2 lattice, float aa) {
  float cover = 0.0;
  int count = 2 + (hash01(lattice, 20u) > 0.5 ? 1 : 0);
  for (int k = 0; k < count; k++) {
    uint h = hash(uvec3(uvec2(lattice), 21u + uint(k)));
    uint h2 = hash(uvec3(uvec2(lattice), 25u + uint(k)));
    float orbit = DNA_ORBIT_MIN + DNA_ORBIT_VARY * octet(h, 0u);
    float drift = DNA_DRIFT * (0.6 + 0.8 * octet(h, 1u));
    float angle = octet(h, 2u) * 2.0 * PI
      + uTime * drift * (octet(h, 3u) < 0.5 ? -1.0 : 1.0);
    vec2 d = u - orbit * vec2(cos(angle), sin(angle));
    float theta = octet(h2, 0u) * 2.0 * PI + uTime * DNA_SPIN;
    float c = cos(theta);
    float s = sin(theta);
    float along = d.x * c + d.y * s;
    float halfLength = DNA_HALF_MIN + DNA_HALF_VARY * octet(h2, 1u);
    if (abs(along) > halfLength) {
      continue;
    }
    float across = -d.x * s + d.y * c;
    // Strands and rungs stay within the helix's amplitude.
    if (abs(across) > DNA_AMPLITUDE + DNA_WIDTH + aa) {
      continue;
    }
    float phase = along * DNA_TWIST + uTime;
    float wave = DNA_AMPLITUDE * sin(phase);
    // The two backbones, and a rung between them every half turn.
    float strand = max(
      1.0 - smoothstep(DNA_WIDTH, DNA_WIDTH + aa, abs(across - wave)),
      1.0 - smoothstep(DNA_WIDTH, DNA_WIDTH + aa, abs(across + wave))
    );
    float turn = phase + PI / 2.0;
    float rung = abs(across) <= abs(wave) + DNA_WIDTH && mod(turn, PI) < DNA_RUNG
      ? 0.8
      : 0.0;
    float ends = 1.0 - smoothstep(halfLength - 0.08, halfLength, abs(along));
    cover = max(cover, max(strand, rung) * ends);
  }
  return cover;
}

// The bubbles look at p - see paintBubbles.
vec4 bubblesLook(vec2 p, float d) {
  if (d < CELL_CLIP_START) {
    return vec4(0.0);
  }
  Bubble best = nearestBubble(p, BUBBLES);
  float baseAlpha = BUBBLE_BASE_ALPHA * smoothstep(EDGE_START, EDGE_END, d);
  float bubbleAlpha = 0.0;
  vec3 face = vec3(0.0);
  if (best.radius > 0.0) {
    float edge = cellEdge(best.q2, best.radius, d);
    if (edge > 0.0) {
      float rim = smoothstep(BUBBLE_RIM_START, BUBBLE_RIM_END, sqrt(best.q2));
      float spot = 1.0 - smoothstep(BUBBLE_SPOT_START, BUBBLE_SPOT_END, length(best.unit - CELL_FOCAL));
      float dna = dnaAt(best.unit, best.lattice, uPixel / best.radius);
      bubbleAlpha = max(max(BUBBLE_FILM, rim * BUBBLE_RIM), max(spot, dna)) * edge;
      // The film and the rim in the light colour, the spot and the
      // snippets towards white.
      face = mix(lightColor(), vec3(1.0), max(spot, dna * 0.7));
    }
  }
  return overBase(face, bubbleAlpha, baseAlpha);
}

// The cells look at p: the colour of the base or of the cell the fragment
// is deepest in, and its alpha - d is the density under the fragment.
vec4 cellsLook(vec2 p, float d) {
  if (d < CELL_CLIP_START) {
    return vec4(0.0);
  }
  Bubble best = nearestBubble(p, CELLS);
  float baseAlpha = BASE_ALPHA * smoothstep(EDGE_START, EDGE_END, d);
  float cellAlpha = best.radius > 0.0 ? cellEdge(best.q2, best.radius, d) : 0.0;
  vec3 face = cellAlpha > 0.0 ? sphereShade(best.unit) : vec3(0.0);
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
      face = mix(lightColor(), uColor * shade, inside);
    } else {
      face = sphereShade((p - tile.xy) / (spacing * TILE_RADIUS))
        * (SEAM_DARK + (1.0 - SEAM_DARK) * inside);
    }
  }
  return overBase(face, tileAlpha, baseAlpha);
}

// The surface's slope at p, per cell, from the density - densitySlope.
vec2 densitySlope(vec2 p) {
  vec2 uv = p / uArena;
  vec2 texel = 1.0 / uArena;
  return vec2(
    texture(uDensity, uv + vec2(texel.x, 0.0)).r - texture(uDensity, uv - vec2(texel.x, 0.0)).r,
    texture(uDensity, uv + vec2(0.0, texel.y)).r - texture(uDensity, uv - vec2(0.0, texel.y)).r
  ) * 0.5;
}

// The highlight of the light mirrored by a surface with that unit normal,
// seen from straight above - highlight in colony-renderer.ts.
float highlight(vec3 n, float shine, float strength) {
  float lit = dot(n, SURFACE_LIGHT);
  return pow(max(0.0, 2.0 * lit * n.z - SURFACE_LIGHT.z), shine) * strength;
}

// A glass marble's colour on its unit disc - marbleShade.
vec3 marbleShade(vec2 u, float q2, float seed) {
  float z = sqrt(max(0.0, 1.0 - q2));
  float q = sqrt(q2);
  vec3 n = vec3(u, z);
  float lit = MARBLE_AMBIENT + (1.0 - MARBLE_AMBIENT) * max(0.0, dot(n, SURFACE_LIGHT));
  float swirl = 0.5 + 0.5 * sin(atan(u.y, u.x) * MARBLE_SWIRL_TURNS + q * MARBLE_SWIRL_RINGS + seed * 2.0 * PI);
  float rim = smoothstep(MARBLE_RIM_START, 1.0, q);
  float away = -dot(u, SURFACE_LIGHT.xy) / length(SURFACE_LIGHT.xy);
  float glow = smoothstep(MARBLE_GLOW_START, MARBLE_GLOW_END, away) * MARBLE_GLOW * (1.0 - rim * 0.5);
  vec3 light = lightColor();
  vec3 dark = mix(uColor, vec3(0.0), TINT_DARK);
  vec3 body = mix(uColor, light, swirl * MARBLE_SWIRL) * lit;
  body = mix(body, dark, rim * MARBLE_RIM);
  body += (light - body) * glow;
  return min(vec3(1.0), body + (1.0 - body) * highlight(n, MARBLE_SHINE, MARBLE_SHINE_STRENGTH));
}

// The marbles look at p - see paintMarbles.
vec4 marblesLook(vec2 p, float d) {
  if (d < CELL_CLIP_START) {
    return vec4(0.0);
  }
  Bubble best = nearestBubble(p, MARBLES);
  float baseAlpha = MARBLE_BASE_ALPHA * smoothstep(EDGE_START, EDGE_END, d);
  float marbleAlpha = best.radius > 0.0 ? cellEdge(best.q2, best.radius, d) : 0.0;
  vec3 face = marbleAlpha > 0.0
    ? marbleShade(best.unit, best.q2, hash01(best.lattice, 7u))
    : vec3(0.0);
  return overBase(face, marbleAlpha, baseAlpha);
}

// 1 where a noise crosses level, 0 width away from it - crack.
float crack(float noise, float level, float width) {
  return 1.0 - smoothstep(0.0, width, abs(noise - level));
}

// The lava look at p - see paintLava.
vec4 lavaLook(vec2 p, float d) {
  float coverage = smoothstep(EDGE_START, EDGE_END, d);
  if (coverage <= 0.0) {
    return vec4(0.0);
  }
  float scale = 1.0 / (LAVA_SCALE * uUnit);
  float flow = uTime * LAVA_FLOW;
  float n = fbm(p * scale + vec2(flow, flow * 0.6) + 31.0);
  vec2 slope = densitySlope(p);
  float lit = clamp(0.55 - dot(slope, SURFACE_LIGHT.xy) * LAVA_RELIEF + (n - 0.5) * LAVA_BUMP, 0.2, 1.0);
  float pulse = 0.65 + 0.35 * sin(uTime * LAVA_PULSE + n * 12.0);
  float core = max(crack(n, 0.5, LAVA_CRACK), crack(n, LAVA_CRACK_2, LAVA_CRACK) * 0.7) * pulse;
  float halo = max(crack(n, 0.5, LAVA_CRACK_HALO), crack(n, LAVA_CRACK_2, LAVA_CRACK_HALO) * 0.7)
    * LAVA_HALO * pulse;
  float front = (1.0 - smoothstep(EDGE_END, LAVA_EDGE_END, d)) * LAVA_EDGE_GLOW;
  float glow = min(1.0, core + halo + front);
  vec3 crust = mix(uColor * LAVA_CRUST, vec3(40.0 / 255.0), LAVA_GREY);
  vec3 hot = mix(uColor, vec3(1.0), LAVA_GLOW_LIGHT);
  vec3 molten = mix(crust * lit, hot, glow);
  return vec4(molten + (1.0 - molten) * core * 0.6, coverage * LAVA_ALPHA);
}

// The galaxy look at p - see paintGalaxy.
vec4 galaxyLook(vec2 p, float d) {
  float coverage = smoothstep(EDGE_START, EDGE_END, d);
  if (coverage <= 0.0) {
    return vec4(0.0);
  }
  float scale = 1.0 / (GALAXY_SCALE * uUnit);
  float drift = uTime * GALAXY_DRIFT;
  float gas = fbm(p * scale + vec2(drift, 0.0) + 41.0);
  float tint = fbm(p * scale * 2.1 + vec2(5.0 - drift, 3.0) + 43.0);
  float cloud = smoothstep(GALAXY_GAS_FROM, GALAXY_GAS_TO, gas) * (0.5 + 0.5 * tint) * GALAXY_GAS;
  float starSpacing = GALAXY_STAR_SPACING * uUnit;
  vec2 cell = floor(p / starSpacing);
  ivec2 lattice = ivec2(cell);
  float h = hash01(lattice, 47u);
  float star = 0.0;
  float starHalo = 0.0;
  if (h > 1.0 - GALAXY_STAR_SHARE) {
    vec2 centre = cell + 0.25 + 0.5 * vec2(hash01(lattice, 48u), hash01(lattice, 49u));
    float twinkle = 0.55 + 0.45 * sin(uTime * GALAXY_TWINKLE + h * 60.0);
    float distance = length(p / starSpacing - centre);
    star = (1.0 - smoothstep(0.0, GALAXY_STAR_RADIUS, distance)) * twinkle;
    starHalo = (1.0 - smoothstep(0.0, GALAXY_STAR_HALO, distance)) * 0.5 * twinkle;
  }
  float shine = smoothstep(0.5, 1.0, d) * GALAXY_CORE + coverage * (1.0 - coverage) * 4.0 * GALAXY_RIM;
  vec3 light = lightColor();
  vec3 space = uColor * GALAXY_DEEP + mix(uColor, light, tint) * cloud + light * (shine + starHalo);
  return vec4(min(vec3(1.0), space + (1.0 - space) * star), coverage * GALAXY_ALPHA);
}

// The plasma look at p - see paintPlasma.
vec4 plasmaLook(vec2 p, float d) {
  float coverage = smoothstep(EDGE_START, EDGE_END, d);
  if (coverage <= 0.0) {
    return vec4(0.0);
  }
  float scale = 1.0 / (PLASMA_SCALE * uUnit);
  float scale2 = 1.0 / (PLASMA_SCALE_2 * uUnit);
  float t = uTime * PLASMA_SPEED;
  // The arcs run where each noise crosses its middle.
  float n = fbm(p * scale + vec2(t, -t * 0.7) + 53.0);
  float n2 = fbm(p * scale2 + vec2(9.0 - t * 0.6, 2.0 + t * 0.4) + 57.0);
  float flicker = 0.75 + 0.25 * sin(uTime * PLASMA_FLICKER + n * 40.0);
  float bolt = min(1.0, (crack(n, 0.5, PLASMA_BOLT) + crack(n2, 0.5, PLASMA_BOLT) * 0.8) * flicker);
  float halo = (crack(n, 0.5, PLASMA_HALO_WIDTH) + crack(n2, 0.5, PLASMA_HALO_WIDTH) * 0.8)
    * PLASMA_HALO * coverage;
  float edge = coverage * (1.0 - coverage) * 4.0 * PLASMA_EDGE;
  vec3 light = lightColor();
  vec3 rgb = uColor * (PLASMA_BODY + halo) + mix(light, vec3(1.0), bolt) * bolt * PLASMA_GLOW + light * edge;
  return vec4(min(vec3(1.0), rgb), max(coverage * PLASMA_ALPHA, min(1.0, bolt + edge)));
}

// The chrome look at p - see paintChrome.
vec4 chromeLook(vec2 p, float d) {
  float coverage = smoothstep(EDGE_START, EDGE_END, d);
  if (coverage <= 0.0) {
    return vec4(0.0);
  }
  float scale = 1.0 / (CHROME_RIPPLE_SCALE * uUnit);
  float step = CHROME_RIPPLE_STEP * uUnit;
  vec2 slope = densitySlope(p);
  // The ripple's slope, read across a step either way.
  float ripple = coverage * CHROME_RIPPLE / (2.0 * step);
  vec3 n = normalize(vec3(
    -slope.x * CHROME_RELIEF
      + (fbm((p + vec2(step, 0.0)) * scale + 61.0) - fbm((p - vec2(step, 0.0)) * scale + 61.0)) * ripple,
    -slope.y * CHROME_RELIEF
      + (fbm((p + vec2(0.0, step)) * scale + 61.0) - fbm((p - vec2(0.0, step)) * scale + 61.0)) * ripple,
    1.0
  ));
  // A surface facing up the screen sees the sky, one facing down the
  // ground, and one facing the viewer the colony's colour at the horizon.
  float up = -n.y;
  vec3 light = lightColor();
  vec3 sky = mix(light, vec3(1.0), CHROME_SKY);
  vec3 ground = mix(uColor, vec3(0.0), CHROME_GROUND);
  vec3 env = up > 0.0
    ? mix(uColor, sky, smoothstep(0.0, CHROME_SKY_REACH, up))
    : mix(uColor, ground, smoothstep(0.0, CHROME_GROUND_REACH, -up));
  float streak = 1.0 + (valueNoise(p * scale * vec2(0.3, 3.0) + 65.0) - 0.5) * CHROME_STREAK;
  float fresnel = pow(1.0 - n.z, 2.0) * CHROME_FRESNEL;
  vec3 metal = min(vec3(1.0), env * streak + light * fresnel);
  float shine = highlight(n, CHROME_SHINE, CHROME_SHINE_STRENGTH);
  return vec4(metal + (1.0 - metal) * shine, coverage * CHROME_ALPHA);
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

${HEX}

// Toxin turns the enemy sickly and bruised, cryo freezes it pale blue with
// frost glittering on it, a shield lays its membrane over the owner's
// colony and a bloom makes the owner's bacteria on it gleam golden.
vec3 applyTints(vec3 rgb, vec2 p) {
  for (int i = 0; i < ${MAX_TINTS}; i++) {
    if (i >= uTintCount) {
      break;
    }
    vec4 tint = uTints[i];
    float mode = uTintModes[i];
    float d = length(p - tint.xy);
    float inside = (1.0 - smoothstep(tint.z * 0.85, tint.z, d)) * tint.w;
    if (inside <= 0.0) {
      continue;
    }
    if (mode < 0.5) {
      float bubble = 0.5 + 0.5 * sin(uTime * 6.0 + d * 0.9 / uUnit);
      float lum = dot(rgb, vec3(0.3, 0.5, 0.2));
      vec3 sick = mix(vec3(0.36, 0.5, 0.06), vec3(0.8, 0.95, 0.25), lum);
      rgb = mix(rgb, sick, inside * (0.6 + 0.2 * bubble));
    } else if (mode < 1.5) {
      float lum = dot(rgb, vec3(0.3, 0.5, 0.2));
      vec3 ice = mix(vec3(0.5, 0.78, 1.0), vec3(0.94, 0.98, 1.0), lum);
      rgb = mix(rgb, ice, inside * 0.7);
      uvec3 key = uvec3(uvec2(floor(p * 1.5)), uint(floor(uTime * 8.0)));
      if (float(hash(key)) / 4294967295.0 > 0.96) {
        rgb = mix(rgb, vec3(1.0), inside);
      }
    } else if (mode < 2.5) {
      vec4 h = hexCell(p / (3.5 * uUnit));
      float edge = 1.0 - smoothstep(0.0, 0.08, 0.5 - hexEdge(h.xy));
      float wave = 0.5 + 0.5 * sin(uTime * 4.0 - length(h.zw) * 0.7);
      rgb = mix(rgb, mix(rgb, vec3(1.0), 0.8), inside * edge * (0.35 + 0.4 * wave));
      rgb += rgb * 0.15 * inside * wave;
    } else {
      float wave = 0.5 + 0.5 * sin(uTime * 3.0 - d * 0.5 / uUnit);
      rgb = mix(rgb, mix(rgb, vec3(1.0, 0.86, 0.42), 0.65), inside * (0.2 + 0.4 * wave * wave));
    }
  }
  return clamp(rgb, 0.0, 1.0);
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
      outColor = vec4(applyTints(uColor + (1.0 - uColor) * heat, cell), uAlpha);
      return;
    }
    float strength = clamp((texel.r - 0.55) / 0.45, 0.0, 1.0);
    outColor = vec4(
      applyTints(uColor, cell),
      uAlpha * (0.3 + 0.7 * strength * strength)
    );
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
      : uLook == LOOK_INK ? inkLook(p, density)
      : uLook == LOOK_BUBBLES ? bubblesLook(p, density)
      : uLook == LOOK_MARBLES ? marblesLook(p, density)
      : uLook == LOOK_LAVA ? lavaLook(p, density)
      : uLook == LOOK_GALAXY ? galaxyLook(p, density)
      : uLook == LOOK_PLASMA ? plasmaLook(p, density)
      : chromeLook(p, density);
    if (look.a <= 0.0) {
      discard;
    }
    float white = burn(p, 0.0, min(1.0, sampled.g / max(density, 0.05)));
    outColor = vec4(
      applyTints(look.rgb + (1.0 - look.rgb) * white, p),
      look.a * uAlpha
    );
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
  outColor = vec4(
    applyTints(body + (1.0 - body) * white, p),
    0.94 * coverage * uAlpha
  );
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
precision highp int;
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

vec2 turn(vec2 q, float angle) {
  float s = sin(-angle);
  float c = cos(-angle);
  return vec2(c * q.x - s * q.y, s * q.x + c * q.y);
}

${HASH}
${NOISE}
${HEX}

// 1 on the borders of jittered cells, like the facets of ice.
float facets(vec2 x) {
  vec2 i = floor(x);
  vec2 f = fract(x);
  float d1 = 8.0;
  float d2 = 8.0;
  for (int y = -1; y <= 1; y++) {
    for (int k = -1; k <= 1; k++) {
      vec2 g = vec2(float(k), float(y));
      vec2 o = vec2(hash21(i + g), hash21(i + g + 31.0));
      float d = length(g + o - f);
      if (d < d1) {
        d2 = d1;
        d1 = d;
      } else if (d < d2) {
        d2 = d;
      }
    }
  }
  return 1.0 - smoothstep(0.0, 0.08, d2 - d1);
}

// A weapon's effect over its circle - q from -1 to 1 across it, grow how
// far it has spread. Returns the colour and its opacity.
vec4 weaponField(vec2 q, float weapon, float t, float grow) {
  float r = length(q);
  float angle = atan(q.y, q.x);
  vec3 rgb;
  float a;
  if (weapon < 0.5) {
    // Toxin: a cloud folding over itself, lighter where it is thick.
    vec2 uv = q * 2.6;
    vec2 warp = vec2(
      fbm(uv + vec2(t * 0.31, -t * 0.22)),
      fbm(uv + vec2(-t * 0.27, t * 0.35) + 5.2)
    );
    float n = fbm(uv * 1.3 + warp * 1.8 + vec2(0.0, t * 0.45));
    float body = 1.0 - smoothstep(0.55, 1.0, r + (n - 0.5) * 0.45);
    rgb = mix(vColor2.rgb, vColor.rgb, smoothstep(0.25, 0.7, n));
    rgb += vec3(0.5, 0.8, 0.25) * pow(max(n - 0.5, 0.0) * 2.0, 2.0) * 0.8;
    a = body * (0.45 + 0.5 * smoothstep(0.2, 0.75, n));
  } else if (weapon < 1.5) {
    // Ice: facets, cracks running out from the centre, a frosted rim.
    float facet = facets(q * 4.5);
    float crack = (1.0 - smoothstep(0.0, 0.05,
      abs(sin(angle * 4.5 + fbm(q * 3.5) * 3.0)) * r)) * smoothstep(0.1, 0.5, r);
    float rim = smoothstep(0.75, 0.95, r);
    float frost = max(facet * 0.6, crack);
    rgb = mix(vColor.rgb, vColor2.rgb, clamp(frost + rim * 0.8, 0.0, 1.0));
    a = 0.32 + 0.45 * frost + 0.45 * rim;
    a *= 1.0 - smoothstep(grow - 0.05, grow, r);
  } else if (weapon < 2.5) {
    // Phage: a wave of hexagons running out, white hot at the start.
    vec4 h = hexCell(q * 6.0);
    float edge = 1.0 - smoothstep(0.0, 0.09, 0.5 - hexEdge(h.xy));
    float wave = 1.0 - smoothstep(0.0, 0.22, abs(r - grow));
    float core = pow(max(1.0 - r, 0.0), 2.0) * (1.0 - grow);
    rgb = mix(vColor2.rgb, vColor.rgb, clamp(wave * 0.5 + core, 0.0, 1.0));
    a = edge * wave * 0.9 + core * 0.8 + wave * 0.12;
  } else if (weapon < 3.5) {
    // Agar: a flower of eight lobes unfurling, rippling with warmth.
    float lobes = abs(cos(angle * 4.0 + sin(t * 0.7) * 0.3));
    float reach = grow * (0.55 + 0.45 * pow(lobes, 0.6));
    float inside = 1.0 - smoothstep(reach - 0.07, reach, r);
    float ripple = 0.5 + 0.5 * sin(r * 22.0 - t * 3.0 + fbm(q * 3.0) * 4.0);
    float grain = fbm(q * 9.0);
    rgb = mix(vColor.rgb, vColor2.rgb,
      clamp((1.0 - r / max(reach, 0.01)) * 0.8 + ripple * 0.2, 0.0, 1.0));
    rgb *= 0.85 + 0.3 * grain;
    a = inside * (0.3 + 0.25 * ripple) + (1.0 - smoothstep(0.0, 0.25, r)) * 0.3 * grow;
  } else {
    // Shield: a membrane of hexagons, a pulse running out through it.
    vec4 h = hexCell(q * 5.5);
    float edge = 1.0 - smoothstep(0.0, 0.07, 0.5 - hexEdge(h.xy));
    float wave = 1.0 - smoothstep(0.0, 0.18, abs(r - fract(t * 0.6)));
    float pulse = 0.5 + 0.5 * sin(t * 4.0 - length(h.zw) * 0.9);
    float rim = smoothstep(0.82, 0.98, r);
    rgb = mix(vColor.rgb, vColor2.rgb, clamp(edge * 0.5 + wave * 0.5 + rim * 0.5, 0.0, 1.0));
    a = edge * (0.25 + 0.3 * pulse + 0.4 * wave) + rim * 0.45 + 0.05;
    a *= 1.0 - smoothstep(grow - 0.08, grow, r);
  }
  a *= 1.0 - smoothstep(0.94, 1.0, r);
  return vec4(rgb, clamp(a, 0.0, 1.0));
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
  } else if (kind == 6) {
    // A soft glow, brightest in the middle and gone at the rim.
    float r = length(vWorld - center) / (vRect.z * 0.5);
    float f = max(1.0 - r * r, 0.0);
    color.a *= f * f;
  } else if (kind == 7) {
    // A hexagon, its corners p2 out - an outline p1 wide, or filled for 0.
    vec2 q = turn(vWorld - center, vExtra.y);
    float s = hexEdge(q.yx) / 0.8660254;
    float aa = fwidth(s);
    color.a *= vExtra.z > 0.0
      ? 1.0 - smoothstep(vExtra.z * 0.5 - aa, vExtra.z * 0.5 + aa, abs(s - vExtra.w))
      : 1.0 - smoothstep(vExtra.w - aa, vExtra.w + aa, s);
  } else if (kind == 8) {
    vec2 q = (vWorld - center) / (vRect.z * 0.5);
    if (dot(q, q) >= 1.0) {
      discard;
    }
    vec4 field = weaponField(q, vExtra.y, vExtra.z, vExtra.w);
    color = vec4(field.rgb, vColor.a * field.a);
  } else if (kind == 9) {
    // An ellipse turned by p0, its radii p1 and p2, shading from the first
    // colour at its base to the second at its tip.
    vec2 q = turn(vWorld - center, vExtra.y);
    vec2 unit;
    color.a *= ellipseCoverage(q, vExtra.zw, unit);
    color.rgb = mix(vColor.rgb, vColor2.rgb, clamp(unit.x * 0.5 + 0.5, 0.0, 1.0));
  }

  if (color.a <= 0.0) {
    discard;
  }
  outColor = color;
}`;
