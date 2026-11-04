import { TICK_MS, TickClock } from './fixed-tick';

describe('TickClock', () => {
  function ticksOf(clock: TickClock, frames: number[]): number[] {
    return frames.map((elapsed) => clock.advance(elapsed).ticks);
  }

  it('runs a tick on every frame of a 60 Hz display', () => {
    const clock = new TickClock();

    expect(ticksOf(clock, Array(6).fill(1000 / 60))).toEqual([
      1, 1, 1, 1, 1, 1,
    ]);
  });

  it('keeps that rhythm while the frames jitter', () => {
    const clock = new TickClock();

    expect(ticksOf(clock, [15.6, 17.4, 16.1, 17.2, 15.9, 17.0])).toEqual([
      1, 1, 1, 1, 1, 1,
    ]);
  });

  it('runs a tick on every second frame of a faster display', () => {
    const clock = new TickClock();

    expect(ticksOf(clock, Array(6).fill(1000 / 120))).toEqual([
      0, 1, 0, 1, 0, 1,
    ]);
  });

  it('catches up with several ticks after a long frame', () => {
    const clock = new TickClock();

    expect(clock.advance(100).ticks).toBe(6);
  });

  it('advances as fast as the clock on the wall in the long run', () => {
    const clock = new TickClock();
    const frames = Array.from({ length: 600 }, (_, i) =>
      i % 3 === 0 ? 7.1 : 6.8
    );

    const ticks = ticksOf(clock, frames).reduce((sum, n) => sum + n, 0);

    const wall = frames.reduce((sum, ms) => sum + ms, 0);
    expect(Math.abs(ticks - wall / TICK_MS)).toBeLessThanOrEqual(1);
  });

  it('tells how far the clock stands towards the next tick', () => {
    const clock = new TickClock();

    expect(clock.advance(TICK_MS / 4).alpha).toBeCloseTo(0.25);
    expect(clock.advance(TICK_MS / 2).alpha).toBeCloseTo(0.75);
    expect(clock.advance(TICK_MS / 2).alpha).toBeCloseTo(0.25);
  });

  it('hands on the time of the frame for what only moves on screen', () => {
    expect(new TickClock().advance(20).elapsedSec).toBeCloseTo(0.02);
  });
});
