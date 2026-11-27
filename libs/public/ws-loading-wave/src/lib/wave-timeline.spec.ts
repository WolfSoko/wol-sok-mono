import { FADE_MS, WaveTimeline } from './wave-timeline';

describe('WaveTimeline', () => {
  it('fades wave and dots in when loading starts, the sweep starting then', () => {
    const timeline = new WaveTimeline('hide', true);
    timeline.start(1000);
    expect(timeline.frameAt(1000).frame).toEqual({
      elapsedMs: 0,
      wave: 0,
      dots: 0,
    });
    expect(timeline.frameAt(1000 + FADE_MS / 2).frame).toEqual({
      elapsedMs: FADE_MS / 2,
      wave: 0.5,
      dots: 0.5,
    });
    const loaded = timeline.frameAt(1000 + FADE_MS * 3);
    expect(loaded.frame).toEqual({ elapsedMs: FADE_MS * 3, wave: 1, dots: 1 });
    // the wave keeps moving
    expect(loaded.settled).toBe(false);
    expect(loaded.finished).toBe(false);
  });

  it("fades everything out after loading with 'hide', then is finished", () => {
    const timeline = new WaveTimeline('hide', true);
    timeline.start(0);
    timeline.stop(2000);
    expect(timeline.frameAt(2000 + FADE_MS / 4).frame).toMatchObject({
      wave: 0.75,
      dots: 0.75,
    });
    const end = timeline.frameAt(2000 + FADE_MS);
    expect(end.frame).toMatchObject({ wave: 0, dots: 0 });
    expect(end).toMatchObject({ settled: true, finished: true });
  });

  it("keeps the dots after loading with 'keep', settled once the wave faded", () => {
    const timeline = new WaveTimeline('keep', true);
    timeline.start(0);
    timeline.stop(2000);
    expect(timeline.frameAt(2000 + FADE_MS / 2)).toMatchObject({
      frame: { wave: 0.5, dots: 1 },
      settled: false,
    });
    expect(timeline.frameAt(2000 + FADE_MS)).toMatchObject({
      frame: { wave: 0, dots: 1 },
      settled: true,
      finished: false,
    });
  });

  it('fades from where it is when loading stops during the fade in', () => {
    const timeline = new WaveTimeline('hide', true);
    timeline.start(0);
    timeline.stop(FADE_MS / 2);
    expect(timeline.frameAt(FADE_MS / 2).frame).toMatchObject({
      wave: 0.5,
      dots: 0.5,
    });
    expect(timeline.frameAt(FADE_MS).frame.dots).toBeCloseTo(0.25, 9);
  });

  it('restarts the sweep from the left edge when loading starts again', () => {
    const timeline = new WaveTimeline('keep', true);
    timeline.start(0);
    timeline.stop(5000);
    timeline.start(5100);
    expect(timeline.frameAt(5300).frame.elapsedMs).toBe(200);
    // the kept dots stay, the wave fades in again
    expect(timeline.frameAt(5100).frame).toMatchObject({ wave: 0, dots: 1 });
  });

  it('ignores a second start or stop', () => {
    const timeline = new WaveTimeline('hide', true);
    timeline.start(0);
    timeline.start(300);
    expect(timeline.frameAt(500).frame.elapsedMs).toBe(500);
    timeline.stop(1000);
    timeline.stop(1300);
    expect(timeline.frameAt(1000 + FADE_MS).finished).toBe(true);
  });

  it('shows no wave without motion and settles once the dots are in', () => {
    const timeline = new WaveTimeline('hide', false);
    timeline.start(0);
    expect(timeline.frameAt(FADE_MS / 2).frame.wave).toBe(0);
    expect(timeline.frameAt(FADE_MS)).toMatchObject({
      frame: { wave: 0, dots: 1 },
      settled: true,
      finished: false,
    });
  });

  it('shows nothing before loading ever started', () => {
    expect(new WaveTimeline('keep', true).frameAt(100)).toMatchObject({
      frame: { wave: 0, dots: 0 },
      finished: true,
    });
  });

  it('starts with the resting dots it is given', () => {
    expect(new WaveTimeline('keep', true, 1).frameAt(100)).toMatchObject({
      frame: { wave: 0, dots: 1 },
      settled: true,
      finished: false,
    });
  });
});
