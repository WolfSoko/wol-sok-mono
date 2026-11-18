import { FramePacer } from './frame-pacer';

/** Feeds a pacer display frames at a rate and returns the gaps it ran on. */
function run(hz: number, frames: number): number[] {
  const pacer = new FramePacer();
  const ticks: number[] = [];
  for (let frame = 0; frame < frames; frame++) {
    const elapsed = pacer.frame((frame * 1000) / hz);
    if (elapsed != null) {
      ticks.push(elapsed);
    }
  }
  return ticks;
}

/** The gaps once the pacer has settled on the display rate. */
function settled(hz: number): number[] {
  return run(hz, 400).slice(-60);
}

describe('FramePacer', () => {
  it('only starts the clock on the first frame', () => {
    expect(new FramePacer().frame(1000)).toBeNull();
  });

  it('runs on every frame of a 60 Hz display', () => {
    for (const gap of settled(60)) {
      expect(gap).toBeCloseTo(1000 / 60);
    }
  });

  it('runs on every frame of a 90 Hz display', () => {
    for (const gap of settled(90)) {
      expect(gap).toBeCloseTo(1000 / 90);
    }
  });

  it('runs on every second frame of a 120 Hz display, evenly', () => {
    for (const gap of settled(120)) {
      expect(gap).toBeCloseTo(1000 / 60);
    }
  });

  it('runs on every second frame of a 144 Hz display, evenly', () => {
    for (const gap of settled(144)) {
      expect(gap).toBeCloseTo(2000 / 144);
    }
  });

  it('runs on every fourth frame of a 240 Hz display', () => {
    for (const gap of settled(240)) {
      expect(gap).toBeCloseTo(1000 / 60);
    }
  });

  it('runs on the next frame after one the display dropped', () => {
    const pacer = new FramePacer();
    for (let frame = 0; frame <= 100; frame++) {
      pacer.frame((frame * 1000) / 60);
    }

    expect(pacer.frame((102 * 1000) / 60)).toBeCloseTo(2000 / 60);
  });

  it('keeps its rate across a long hiccup', () => {
    const pacer = new FramePacer();
    for (let frame = 0; frame <= 100; frame++) {
      pacer.frame((frame * 1000) / 60);
    }
    pacer.frame(5000);

    expect(pacer.frame(5000 + 1000 / 60)).toBeCloseTo(1000 / 60);
  });
});
