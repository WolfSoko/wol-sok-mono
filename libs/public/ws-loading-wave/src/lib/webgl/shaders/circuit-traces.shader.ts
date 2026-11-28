import type { LoadingWaveShader } from '../loading-wave-shader';

/**
 * A printed circuit board: each grid cell leads a copper trace on to the
 * right, now and then jogging a row up or down at 45° within a pair of rows,
 * so the cells join into traces running left to right, with the dots as
 * solder points and some of them pads. Ahead of the front the board lies
 * dark; behind it the traces light up in the accent colour and current
 * pulses, bright packets with comet tails, run on along them at a speed per
 * pair of rows (a differential pair, so a pulse runs on through a jog),
 * flashing the pads they pass, then die out in the afterglow.
 */
export const circuitTracesShader: LoadingWaveShader = {
  fragment: `
const float TRACE_WIDTH = 0.07;
const float TRACE_REST_ALPHA = 0.12;
const float TRACE_LIT_ALPHA = 0.6;
const float PAD_RADIUS = 0.17;
const float PAD_HOLE = 0.45;
const float PAD_CHANCE = 0.35;
const float PAD_RING_ALPHA = 0.7;
const float PAD_FLASH = 1.5;
const float PULSE_GLOW_WIDTH = 0.2;
const float PULSE_ALPHA = 0.9;
const float PULSE_HEAD_GLOW = 0.5;
const float PULSE_HEAD_EDGE = 0.15;
const float PULSE_PERIOD_SPACINGS = 7.0;
const float PULSE_TAIL_SPACINGS = 1.6;
const float PULSE_SPEED_SPACINGS = 9.0;
const float PULSE_SPEED_SPREAD = 0.6;
const float PULSE_WHITENING = 0.4;
const float JOG_CHANCE = 0.4;
const float GAP_CHANCE = 0.1;

/* the pair of rows a row belongs to; traces jog only within a pair */
float rowPair(float row) {
  return floor(row * 0.5);
}

/*
 * Where the trace leaving a cell goes: 0 a gap, 1 straight on to the right,
 * 2 a jog a row down, -2 a jog a row up. In a pair only the top row jogs
 * down or the bottom row jogs up at a column, so no traces cross.
 */
float traceKind(vec2 cell) {
  if (ws_hash(cell + vec2(17.0, 3.0)) < GAP_CHANCE) {
    return 0.0;
  }
  float pair = rowPair(cell.y);
  bool top = cell.y - 2.0 * pair < 0.5;
  float jog = ws_hash(vec2(cell.x, pair) + vec2(5.0, 41.0));
  if (jog < 0.5 * JOG_CHANCE) {
    return top ? 2.0 : 1.0;
  }
  if (jog < JOG_CHANCE) {
    return top ? 1.0 : -2.0;
  }
  return 1.0;
}

/* where the trace leaving a cell ends: the next column's centre, maybe a row off */
vec2 traceEnd(vec2 cell, float kind) {
  float rows = kind > 1.5 ? 1.0 : (kind < -1.5 ? -1.0 : 0.0);
  return ws_cellCenter(cell + vec2(1.0, rows));
}

/* how far x lies behind the head of a pair's current pulse, 0 up to one period */
float behindPulse(float x, float pair) {
  float speed = PULSE_SPEED_SPACINGS * ws_spacing
    * (1.0 - 0.5 * PULSE_SPEED_SPREAD + PULSE_SPEED_SPREAD * ws_hash(vec2(pair, 7.0)));
  float period = PULSE_PERIOD_SPACINGS * ws_spacing;
  return mod(ws_time * speed - x + ws_hash(vec2(pair, 13.0)) * period, period);
}

/* a pulse's brightness: 1 at its head, a comet tail behind it */
float comet(float behind) {
  float period = PULSE_PERIOD_SPACINGS * ws_spacing;
  return exp(-behind / (PULSE_TAIL_SPACINGS * ws_spacing))
    * smoothstep(0.0, PULSE_HEAD_EDGE * ws_spacing, period - behind);
}

vec4 wsShade(vec2 point) {
  vec2 cell = ws_cell(point);
  float traceWidth = max(TRACE_WIDTH * ws_spacing, 1.5 * ws_pixel);
  float glowWidth = PULSE_GLOW_WIDTH * ws_spacing;
  float nearest = 1.0e6;
  float tracePair = rowPair(cell.y);
  for (int row = -1; row <= 1; row++) {
    for (int column = -1; column <= 0; column++) {
      vec2 from = cell + vec2(float(column), float(row));
      float kind = traceKind(from);
      if (kind == 0.0) {
        continue;
      }
      float away = ws_segmentDistance(point, ws_cellCenter(from), traceEnd(from, kind));
      if (away < nearest) {
        nearest = away;
        tracePair = rowPair(from.y);
      }
    }
  }
  float trace = ws_band(nearest, traceWidth);
  float lit = ws_waveIntensity(point);
  float behind = behindPulse(point.x, tracePair);
  float current = lit * comet(behind);
  // the head glows round, off the trace too
  float toHead = min(behind, PULSE_PERIOD_SPACINGS * ws_spacing - behind);
  float headGlow = lit * exp(-(toHead * toHead + nearest * nearest) / (2.0 * glowWidth * glowWidth));
  vec4 ink = ws_ink(lit);
  float copper = trace * ink.a * mix(TRACE_REST_ALPHA, TRACE_LIT_ALPHA, lit);
  float pulse = ws_accent.a * PULSE_ALPHA * max(current * trace, PULSE_HEAD_GLOW * headGlow);

  // every dot of the grid is a solder point; some are pads, a copper ring around it
  vec2 padCenter = ws_cellCenter(cell);
  bool onGrid = all(lessThan(padCenter, ws_size));
  float padLit = ws_waveIntensity(padCenter);
  // a passing pulse makes the pad flash brighter than the wave alone
  float flash = clamp(padLit * (1.0 + PAD_FLASH * comet(behindPulse(padCenter.x, rowPair(cell.y)))), 0.0, 1.0);
  float padRadius = max(PAD_RADIUS * ws_spacing, 0.75 * ws_dotSize + ws_pixel);
  float ring = ws_hash(cell + vec2(29.0, 11.0)) < PAD_CHANCE
    ? ws_dotDisk(point, padCenter, padRadius)
      * (1.0 - ws_dotDisk(point, padCenter, PAD_HOLE * padRadius))
    : 0.0;
  float pad = onGrid ? max(PAD_RING_ALPHA * ring, ws_dotDisk(point, padCenter, 0.5 * ws_dotSize)) : 0.0;
  vec4 padInk = ws_ink(flash);
  float padAlpha = pad * padInk.a * mix(WS_REST_ALPHA, 1.0, flash);

  // the pad sits on top of the trace, the pulse on top of both
  float alpha = padAlpha + (1.0 - padAlpha) * copper;
  vec3 color = padInk.rgb * padAlpha + ink.rgb * (1.0 - padAlpha) * copper;
  vec3 hot = mix(ws_accent.rgb, vec3(1.0), PULSE_WHITENING * current);
  color = color * (1.0 - pulse) + hot * pulse;
  alpha = alpha * (1.0 - pulse) + pulse;
  return alpha <= 0.0 ? vec4(0.0) : vec4(color / alpha, alpha);
}
`,
};
