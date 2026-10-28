import {
  AdaptiveQuality,
  QUALITY_WINDOW_MS,
  RENDER_SCALES,
  SLOW_WINDOWS,
  SMOOTH_WINDOWS,
} from './adaptive-quality';

/**
 * Plays frames at `fps` for `seconds`, each keeping the main thread busy
 * for `busyMs` - none by default: they wait on the GPU. Keeps every scale
 * it changes to.
 */
function play(
  quality: AdaptiveQuality,
  clock: { now: number },
  fps: number,
  seconds: number,
  busyMs = 0
): number[] {
  const changes: number[] = [];
  const frames = Math.round(fps * seconds);
  for (let i = 0; i < frames; i++) {
    clock.now += 1000 / fps;
    const scale = quality.frame(clock.now, busyMs);
    if (scale !== null) {
      changes.push(scale);
    }
  }
  return changes;
}

// A frame or two past the windows - the first frame only starts the clock.
const windows = (count: number) => (count * QUALITY_WINDOW_MS) / 1000 + 0.5;

describe('AdaptiveQuality', () => {
  let quality: AdaptiveQuality;
  let clock: { now: number };

  beforeEach(() => {
    quality = new AdaptiveQuality();
    quality.start(1);
    clock = { now: 0 };
  });

  it('keeps every pixel while the frames are smooth', () => {
    expect(play(quality, clock, 60, 20)).toEqual([]);
    expect(quality.scale).toBe(1);
  });

  it('steps down after slow seconds spent waiting, and on while they last', () => {
    expect(play(quality, clock, 30, windows(SLOW_WINDOWS))).toEqual([
      RENDER_SCALES[1],
    ]);
    // Faster, but still slow: the next step follows.
    expect(play(quality, clock, 40, windows(SLOW_WINDOWS))).toEqual([
      RENDER_SCALES[2],
    ]);
    expect(quality.scale).toBe(RENDER_SCALES[2]);
  });

  it('keeps every pixel where the ticks fill the frames', () => {
    expect(play(quality, clock, 30, 20, 30)).toEqual([]);
    expect(quality.scale).toBe(1);
  });

  it('goes as far as the coarsest scale where the pixels hold it back', () => {
    // Frames as long as the pixels painted, and too many even at the end.
    for (let i = 0; i < 30 * 60; i++) {
      clock.now += 100 * quality.scale ** 2;
      quality.frame(clock.now, 5);
    }
    expect(quality.scale).toBe(RENDER_SCALES[RENDER_SCALES.length - 1]);
  });

  it('steps up from where a match started once it is smooth', () => {
    quality.start(RENDER_SCALES[2]);
    expect(play(quality, clock, 60, windows(SMOOTH_WINDOWS))).toEqual([
      RENDER_SCALES[1],
    ]);
    expect(play(quality, clock, 60, windows(SMOOTH_WINDOWS))).toEqual([1]);
    expect(play(quality, clock, 60, 20)).toEqual([]);
  });

  it('goes down only once a match stepped down', () => {
    play(quality, clock, 30, windows(SLOW_WINDOWS));
    play(quality, clock, 60, windows(1));
    expect(play(quality, clock, 60, 20)).toEqual([]);
    expect(quality.scale).toBe(RENDER_SCALES[1]);
  });

  it('steps down on a device that shows only a few frames a second', () => {
    expect(play(quality, clock, 3, windows(SLOW_WINDOWS))).toEqual([
      RENDER_SCALES[1],
    ]);
  });

  it('takes a long frame for a pause, not a slow second', () => {
    play(quality, clock, 60, 0.5);
    // A pause of 3 s, then smooth frames again.
    clock.now += 3000;
    expect(play(quality, clock, 60, 5)).toEqual([]);
    expect(quality.scale).toBe(1);
  });
});
