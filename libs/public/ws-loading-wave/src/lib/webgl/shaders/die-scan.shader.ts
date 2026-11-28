import type { LoadingWaveShader } from '../loading-wave-shader';

/**
 * A chip powering up: the element is cut along the grid's lines into blocks
 * by a hashed recursive split, large cores and small cells with rails
 * between them, each block filled with a micro pattern on the dot pitch
 * (dots, stripes, a hatch or cells). The front powers the die on: a block
 * flickers on as the front reaches its left edge, its rails and pattern
 * light up in the accent colour, and it keeps a low afterglow.
 */
export const dieScanShader: LoadingWaveShader = {
  fragment: `
const int SPLIT_LEVELS = 5;
const float MIN_BLOCK_CELLS = 2.0;
const float LEAF_CHANCE = 0.3;
const float INSET_SPACINGS = 0.3;
const float RAIL_WIDTH = 0.08;
const float RAIL_REST_ALPHA = 0.14;
const float RAIL_LIT_ALPHA = 0.75;
const float FILL_ALPHA = 0.07;
const float PATTERN_REST_ALPHA = 0.6;
const float LINE_WIDTH = 0.06;
const float FLICKER_SPACINGS = 1.5;
const float FLICKERS_PER_SECOND = 24.0;
const float FLICKER_OFF_CHANCE = 0.35;
const float PATTERN_KINDS = 4.0;
const float STRIPE_ALPHA = 0.6;
const float HATCH_ALPHA = 0.5;
const float CELL_SQUARE_SPACINGS = 0.3;

/*
 * The block, in cells (min in xy, max in zw), that a point lies in: the
 * grid is split again and again across its longer side at a hashed cell line.
 */
vec4 dieBlock(vec2 point) {
  vec2 cells = point / ws_spacing;
  vec4 box = vec4(0.0, 0.0, ceil(ws_size / ws_spacing));
  for (int level = 0; level < SPLIT_LEVELS; level++) {
    vec2 extent = box.zw - box.xy;
    float seed = ws_hash(box.xy * 7.0 + box.zw * 13.0 + float(level));
    bool across = extent.x >= extent.y;
    float span = across ? extent.x : extent.y;
    if (span < 2.0 * MIN_BLOCK_CELLS || (level >= 2 && seed < LEAF_CHANCE)) {
      break;
    }
    float cut = floor(mix(MIN_BLOCK_CELLS, span - MIN_BLOCK_CELLS, ws_hash(box.zw + box.xy * 3.0 + 0.5)) + 0.5);
    if (across) {
      float x = box.x + cut;
      box = cells.x < x ? vec4(box.xy, x, box.w) : vec4(x, box.y, box.zw);
    } else {
      float y = box.y + cut;
      box = cells.y < y ? vec4(box.x, box.y, box.z, y) : vec4(box.x, y, box.zw);
    }
  }
  return box;
}

/*
 * How far p lies inside its block from the block's inner edges, in CSS
 * pixels; the host's own edges count as far away, so no rail runs there.
 */
float toInnerEdge(vec2 p, vec4 box) {
  vec2 low = box.xy * ws_spacing;
  vec2 high = min(box.zw * ws_spacing, ws_size);
  vec2 fromLow = p - low + 1.0e6 * vec2(lessThanEqual(box.xy, vec2(0.0)));
  vec2 toHigh = high - p + 1.0e6 * vec2(greaterThanEqual(high, ws_size));
  return min(min(fromLow.x, fromLow.y), min(toHigh.x, toHigh.y));
}

/*
 * A block's micro pattern at p, 0 to 1: dots, stripes, a hatch or cells,
 * kept off the rails by the inset. Dots sit where the grid has them, whole.
 */
float microPattern(vec2 p, vec4 box, float kind) {
  float inset = INSET_SPACINGS * ws_spacing;
  float edge = 0.5 * ws_pixel;
  float inside = smoothstep(inset - edge, inset + edge, toInnerEdge(p, box));
  vec2 center = ws_cellCenter(ws_cell(p));
  bool dotShown = all(lessThan(center, ws_size)) && toInnerEdge(center, box) >= inset;
  float dotCover = dotShown ? ws_dotDisk(p, center, 0.5 * ws_dotSize) : 0.0;
  float lineWidth = max(LINE_WIDTH * ws_spacing, ws_pixel);
  float lines = 0.0;
  if (kind < 1.0) {
    lines = 0.0;
  } else if (kind < 2.0) {
    lines = STRIPE_ALPHA * ws_band(abs(p.y - center.y), lineWidth);
  } else if (kind < 3.0) {
    // 45° lines through the dots, measured across them
    float diagonal = (p.x + p.y) / ws_spacing;
    float away = abs(fract(diagonal) - 0.5) * ws_spacing * inversesqrt(2.0);
    lines = HATCH_ALPHA * ws_band(away, lineWidth);
  } else {
    vec2 fromCenter = abs(p - center);
    float square = abs(max(fromCenter.x, fromCenter.y) - CELL_SQUARE_SPACINGS * ws_spacing);
    lines = STRIPE_ALPHA * ws_band(square, lineWidth);
  }
  return max(dotCover, inside * lines);
}

vec4 wsShade(vec2 point) {
  vec4 box = dieBlock(point);
  vec2 low = box.xy * ws_spacing;
  vec2 high = min(box.zw * ws_spacing, ws_size);
  float blockSeed = ws_hash(box.xy * 5.0 + box.zw * 11.0);

  // the block powers on when the front reaches the middle of its left edge
  vec2 anchor = vec2(low.x, 0.5 * (low.y + high.y));
  float power = ws_waveIntensity(anchor);
  float sinceReached = ws_behindFront(anchor);
  if (sinceReached >= 0.0 && sinceReached < FLICKER_SPACINGS * ws_spacing) {
    float flickerFrame = floor(ws_time * FLICKERS_PER_SECOND);
    power *= step(FLICKER_OFF_CHANCE, ws_hash(vec2(blockSeed * 97.0, flickerFrame)));
  }

  // rails run along the block's inner edges, half on each side
  float rail = ws_band(toInnerEdge(point, box), 2.0 * max(RAIL_WIDTH * ws_spacing, ws_pixel));
  float pattern = microPattern(point, box, floor(blockSeed * PATTERN_KINDS));

  vec4 ink = ws_ink(power);
  float railAlpha = rail * ink.a * mix(RAIL_REST_ALPHA, RAIL_LIT_ALPHA, power);
  float patternAlpha = pattern * ink.a * mix(WS_REST_ALPHA * PATTERN_REST_ALPHA, WS_LIT_ALPHA, power);
  float fill = FILL_ALPHA * power * ws_accent.a;
  float alpha = max(railAlpha, patternAlpha);
  vec3 color = ink.rgb * alpha + ws_accent.rgb * fill * (1.0 - alpha);
  alpha += fill * (1.0 - alpha);
  return alpha <= 0.0 ? vec4(0.0) : vec4(color / alpha, alpha);
}
`,
};
