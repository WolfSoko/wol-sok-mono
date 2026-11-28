import type { LoadingWaveShader } from '../loading-wave-shader';

/**
 * A printed circuit board: each grid cell leads a copper trace on to the
 * right, now and then jogging a row up or down at 45°, so the cells join into
 * traces running left to right, with the dots as pads. Ahead of the front
 * the board lies dark; behind it the traces light up in the accent colour
 * and current pulses, bright packets with comet tails, run on along them at
 * a speed per row, flashing the pads they pass, then die out in the
 * afterglow.
 */
export const circuitTracesShader: LoadingWaveShader = {
  fragment: `
const float TRACE_WIDTH = 0.07;
const float TRACE_REST_ALPHA = 0.12;
const float TRACE_LIT_ALPHA = 0.6;
const float PAD_RADIUS = 0.17;
const float PAD_HOLE = 0.45;
const float PAD_CHANCE = 0.35;
const float PULSE_GLOW_WIDTH = 0.2;
const float PULSE_ALPHA = 0.9;
const float PULSE_PERIOD_SPACINGS = 7.0;
const float PULSE_TAIL_SPACINGS = 1.6;
const float PULSE_SPEED_SPACINGS = 9.0;
const float JOG_CHANCE = 0.4;
const float GAP_CHANCE = 0.1;

/*
 * Where the trace leaving a cell goes: 0 a gap, 1 straight on to the right,
 * 2 a jog a row down, -2 a jog a row up. Rows pair up; in a pair only the top
 * row jogs down or the bottom row jogs up at a column, so no traces cross.
 */
float traceKind(vec2 cell) {
  if (ws_hash(cell + vec2(17.0, 3.0)) < GAP_CHANCE) {
    return 0.0;
  }
  float pair = floor(cell.y * 0.5);
  float top = cell.y - 2.0 * pair < 0.5 ? 1.0 : 0.0;
  float jog = ws_hash(vec2(cell.x, pair) + vec2(5.0, 41.0));
  if (jog < 0.5 * JOG_CHANCE) {
    return top > 0.5 ? 2.0 : 1.0;
  }
  if (jog < JOG_CHANCE) {
    return top > 0.5 ? 1.0 : -2.0;
  }
  return 1.0;
}

/* where the trace leaving a cell ends: the next column's centre, maybe a row off */
vec2 traceEnd(vec2 cell, float kind) {
  float rows = kind > 1.5 ? 1.0 : (kind < -1.5 ? -1.0 : 0.0);
  return ws_cellCenter(cell + vec2(1.0, rows));
}

/* the distance from p to the segment from a to b */
float toSegment(vec2 p, vec2 a, vec2 b) {
  vec2 ab = b - a;
  float along = clamp(dot(p - a, ab) / max(dot(ab, ab), 1.0e-6), 0.0, 1.0);
  return length(p - a - ab * along);
}

/* how far x lies behind the head of the row's current pulse, 0 up to one period */
float behindPulse(float x, float row) {
  float speed = PULSE_SPEED_SPACINGS * ws_spacing * (0.7 + 0.6 * ws_hash(vec2(row, 7.0)));
  float period = PULSE_PERIOD_SPACINGS * ws_spacing;
  return mod(ws_time * speed - x + ws_hash(vec2(row, 13.0)) * period, period);
}

/* a pulse's brightness: 1 at its head, a comet tail behind it */
float comet(float behind) {
  return exp(-behind / (PULSE_TAIL_SPACINGS * ws_spacing))
    * smoothstep(0.0, 0.15 * ws_spacing, PULSE_PERIOD_SPACINGS * ws_spacing - behind);
}

vec4 wsShade(vec2 point) {
  vec2 cell = ws_cell(point);
  float traceWidth = max(TRACE_WIDTH * ws_spacing, 1.5 * ws_pixel);
  float glowWidth = PULSE_GLOW_WIDTH * ws_spacing;
  float nearest = 1.0e6;
  float traceRow = cell.y;
  for (int row = -1; row <= 1; row++) {
    for (int column = -1; column <= 0; column++) {
      vec2 from = cell + vec2(float(column), float(row));
      float kind = traceKind(from);
      if (kind == 0.0) {
        continue;
      }
      vec2 start = ws_cellCenter(from);
      vec2 end = traceEnd(from, kind);
      float away = toSegment(point, start, end);
      if (away < nearest) {
        nearest = away;
        traceRow = from.y;
      }
    }
  }
  float edge = 0.5 * ws_pixel;
  float trace = 1.0 - smoothstep(0.5 * traceWidth - edge, 0.5 * traceWidth + edge, nearest);
  float lit = ws_waveIntensity(point);
  float behind = behindPulse(point.x, traceRow);
  float current = lit * comet(behind);
  // the head glows round, off the trace too
  float toHead = min(behind, PULSE_PERIOD_SPACINGS * ws_spacing - behind);
  float headGlow = lit * exp(-(toHead * toHead + nearest * nearest) / (2.0 * glowWidth * glowWidth));
  vec4 ink = ws_ink(lit);
  float copper = trace * ink.a * mix(TRACE_REST_ALPHA, TRACE_LIT_ALPHA, lit);
  float pulse = ws_accent.a * PULSE_ALPHA * max(current * trace, 0.5 * headGlow);

  vec2 padCenter = ws_cellCenter(cell);
  float padLit = ws_waveIntensity(padCenter);
  float flash = padLit * comet(behindPulse(padCenter.x, cell.y));
  // every dot is a solder point; some are pads, a copper ring around it
  float padRadius = max(PAD_RADIUS * ws_spacing, 0.75 * ws_dotSize + ws_pixel);
  float ring = ws_hash(cell + vec2(29.0, 11.0)) < PAD_CHANCE
    ? ws_dotDisk(point, padCenter, padRadius)
      * (1.0 - ws_dotDisk(point, padCenter, PAD_HOLE * padRadius))
    : 0.0;
  float pad = max(ring * 0.7, ws_dotDisk(point, padCenter, 0.5 * ws_dotSize));
  vec4 padInk = ws_ink(max(padLit, flash));
  float padAlpha = pad * padInk.a * mix(WS_REST_ALPHA, 1.0, max(padLit, flash));

  // the pad sits on top of the trace, the pulse on top of both
  float alpha = padAlpha + (1.0 - padAlpha) * copper;
  vec3 color = padInk.rgb * padAlpha + ink.rgb * (1.0 - padAlpha) * copper;
  vec3 hot = mix(ws_accent.rgb, vec3(1.0), 0.4 * current);
  color = color * (1.0 - pulse) + hot * pulse;
  alpha = alpha * (1.0 - pulse) + pulse;
  return alpha <= 0.0 ? vec4(0.0) : vec4(color / alpha, alpha);
}
`,
};
