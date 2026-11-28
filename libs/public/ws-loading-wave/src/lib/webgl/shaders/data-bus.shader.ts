import type { LoadingWaveShader } from '../loading-wave-shader';

/**
 * A logic analyser: the grid's rows are the lanes of buses, four or five
 * lanes each with a gap between buses, now and then a whole bus bending a
 * lane down and back. Each lane carries bits, a short dash for a zero and a
 * long one for a one. Ahead of the front they idle dim and still; the front
 * is a clock edge: behind it the bits flip, brighten and stream on to the
 * right at a speed per bus.
 */
export const dataBusShader: LoadingWaveShader = {
  fragment: `
const float BLOCK_ROWS = 6.0;
const float MIN_LANES = 4.0;
const float STRETCH_COLUMNS = 6.0;
const float BEND_CHANCE = 0.35;
const float LANE_ALPHA = 0.07;
const float IDLE_ALPHA = 0.5;
const float CLOCKED_THRESHOLD = 0.02;
const float BIT_GROWTH = 0.6;
const float SPEED_SPACINGS = 3.0;
const float ZERO_LENGTH = 0.25;
const float ONE_LENGTH = 0.7;

/* 1 where a bus is bent a lane down at the start of a stretch of columns, else 0 */
float bentAt(float block, float stretch) {
  return ws_hash(vec2(block, stretch) + vec2(3.0, 71.0)) < BEND_CHANCE ? 1.0 : 0.0;
}

/*
 * How many rows a bus is shifted down at x, 0 to 1. A bend runs at 45° over
 * the first column of a stretch, from the last stretch's shift to this one's.
 */
float busShift(float block, float x) {
  float stretchLength = STRETCH_COLUMNS * ws_spacing;
  float stretch = floor(x / stretchLength);
  float into = (x - stretch * stretchLength) / ws_spacing;
  float before = bentAt(block, stretch - 1.0);
  float now = bentAt(block, stretch);
  return mix(before, now, clamp(into - 0.5, 0.0, 1.0));
}

/* the coverage of a bit dash of the given length, centred in its slot, round-capped */
float bitDash(float along, float across, float dashLength, float radius) {
  float halfLength = 0.5 * dashLength * ws_spacing;
  float fromMiddle = abs(along - 0.5 * ws_spacing);
  float away = length(vec2(max(fromMiddle - halfLength, 0.0), across));
  float edge = 0.5 * ws_pixel;
  return 1.0 - smoothstep(radius - edge, radius + edge, away);
}

vec4 wsShade(vec2 point) {
  float blockHeight = BLOCK_ROWS * ws_spacing;
  float block = floor(point.y / blockHeight);
  float lanes = MIN_LANES + floor(ws_hash(vec2(block, 5.0)) * (BLOCK_ROWS - MIN_LANES));
  float shift = busShift(block, point.x);
  float local = point.y - block * blockHeight - shift * ws_spacing;
  float lane = floor(local / ws_spacing);
  float laneCenter = point.y - local + (lane + 0.5) * ws_spacing;
  // no lane outside the lanes of the bus or cut by the host's bottom edge
  if (lane < 0.0 || lane >= lanes || laneCenter >= ws_size.y) {
    return vec4(0.0);
  }
  // a bent stretch runs at 45°: measure across the lane, not straight down
  float slope = abs(busShift(block, point.x + 0.5 * ws_pixel) - busShift(block, point.x - 0.5 * ws_pixel))
    * ws_spacing / ws_pixel;
  float across = abs(local - (lane + 0.5) * ws_spacing) / sqrt(1.0 + slope * slope);
  float laneId = block * BLOCK_ROWS + lane;

  float lit = ws_waveIntensity(point);
  bool clocked = lit > CLOCKED_THRESHOLD;
  float speed = clocked ? SPEED_SPACINGS * ws_spacing * (0.6 + 0.8 * ws_hash(vec2(block, 9.0))) : 0.0;
  float streamed = point.x - (clocked ? ws_time * speed : 0.0);
  float slot = floor(streamed / ws_spacing);
  float along = streamed - slot * ws_spacing;
  float one = step(0.5, ws_hash(vec2(laneId, slot) + (clocked ? vec2(113.0, 17.0) : vec2(0.0))));
  float radius = 0.5 * ws_dotSize * (1.0 + BIT_GROWTH * lit);
  float bit = bitDash(along, across, mix(ZERO_LENGTH, ONE_LENGTH, one), radius);
  float edge = 0.5 * ws_pixel;
  float wire = 1.0 - smoothstep(0.25 * ws_dotSize - edge, 0.25 * ws_dotSize + edge, across);

  vec4 ink = ws_ink(lit);
  float bitAlpha = bit * ink.a * mix(WS_REST_ALPHA * IDLE_ALPHA, WS_LIT_ALPHA, lit);
  float wireAlpha = wire * ink.a * mix(LANE_ALPHA, 0.3, lit);
  float alpha = bitAlpha + (1.0 - bitAlpha) * wireAlpha;
  return alpha <= 0.0 ? vec4(0.0) : vec4(ink.rgb, alpha);
}
`,
};
