import type { LoadingWaveShader } from '../loading-wave-shader';

/**
 * An oscilloscope: the dot grid is the graticule, and up to three digital
 * signals (square waves of hashed bits, the last a clock) run across it on
 * its rows. The front draws them as it sweeps: a bright phosphor head where
 * it crosses a signal, a decaying trail behind it and a slight bloom; at
 * rest the signals lie faint. The sparest of the circuits, good on small
 * hosts.
 */
export const signalTraceShader: LoadingWaveShader = {
  fragment: `
const int MAX_SIGNALS = 3;
const float ROWS_PER_SIGNAL = 3.0;
const float SWING_SPACINGS = 1.0;
const float LINE_WIDTH = 0.09;
const float TRACE_REST_ALPHA = 0.12;
const float HEAD_SPACINGS = 0.5;
const float HEAD_ALPHA = 0.8;
const float BLOOM_SPACINGS = 0.35;
const float BLOOM_ALPHA = 0.25;
const float PHOSPHOR_WHITENING = 0.5;

/* a signal's level in a column, 0 low or 1 high: hashed bits, the last signal a clock */
float signalLevel(float signal, float lastSignal, float column) {
  if (signal >= lastSignal) {
    return mod(column, 2.0);
  }
  return step(0.5, ws_hash(vec2(signal * 31.0 + 7.0, column)));
}

/* the distance from p to the nearest signal */
float toSignals(vec2 p) {
  float rows = floor(ws_size.y / ws_spacing);
  float signals = clamp(floor(rows / ROWS_PER_SIGNAL), 1.0, float(MAX_SIGNALS));
  float swing = SWING_SPACINGS * ws_spacing;
  // a column runs from one dot to the next, so the edges stand on the dots
  float column = floor(p.x / ws_spacing - 0.5);
  float edgeX = (column + 0.5) * ws_spacing;
  float nearest = 1.0e6;
  for (int index = 0; index < MAX_SIGNALS; index++) {
    float signal = float(index);
    if (signal >= signals) {
      break;
    }
    // spread over the rows, both lines on rows of dots
    float row = floor((signal + 1.0) * rows / (signals + 1.0));
    float low = ws_cellCenter(vec2(0.0, row)).y;
    float high = low - swing;
    float level = signalLevel(signal, signals - 1.0, column);
    nearest = min(nearest, abs(p.y - mix(low, high, level)));
    if (signalLevel(signal, signals - 1.0, column - 1.0) != level) {
      nearest = min(nearest, ws_segmentDistance(p, vec2(edgeX, low), vec2(edgeX, high)));
    }
    if (signalLevel(signal, signals - 1.0, column + 1.0) != level) {
      nearest = min(nearest, ws_segmentDistance(p, vec2(edgeX + ws_spacing, low), vec2(edgeX + ws_spacing, high)));
    }
  }
  return nearest;
}

vec4 wsShade(vec2 point) {
  float away = toSignals(point);
  float lineWidth = max(LINE_WIDTH * ws_spacing, 1.5 * ws_pixel);
  float line = ws_band(away, lineWidth);

  float lit = ws_waveIntensity(point);
  float behind = ws_behindFront(point) / (HEAD_SPACINGS * ws_spacing);
  float head = ws_wave * exp(-behind * behind);
  float bloomWidth = BLOOM_SPACINGS * ws_spacing;
  float bloom = lit * exp(-away * away / (2.0 * bloomWidth * bloomWidth));

  vec2 center = ws_cellCenter(ws_cell(point));
  float graticule = all(lessThan(center, ws_size))
    ? ws_dotDisk(point, center, 0.5 * ws_dotSize) * ws_color.a * WS_REST_ALPHA
    : 0.0;

  vec4 ink = ws_ink(lit);
  float trace = line * ink.a * mix(TRACE_REST_ALPHA, WS_LIT_ALPHA, lit);
  float glow = ws_accent.a * (BLOOM_ALPHA * bloom + HEAD_ALPHA * head * line);
  float alpha = graticule + (1.0 - graticule) * trace;
  vec3 color = ws_color.rgb * graticule + ink.rgb * (1.0 - graticule) * trace;
  // the phosphor head burns lighter than the trace behind it
  vec3 phosphor = mix(ws_accent.rgb, vec3(1.0), PHOSPHOR_WHITENING * head);
  color = color * (1.0 - glow) + phosphor * glow;
  alpha = alpha * (1.0 - glow) + glow;
  return alpha <= 0.0 ? vec4(0.0) : vec4(color / alpha, alpha);
}
`,
};
