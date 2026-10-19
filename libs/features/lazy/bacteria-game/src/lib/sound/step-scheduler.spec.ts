import { StepScheduler } from './step-scheduler';

describe('StepScheduler', () => {
  let time: number;
  const context = {
    get currentTime() {
      return time;
    },
  } as AudioContext;

  beforeEach(() => {
    time = 10;
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function schedule(steps = 4, stepSec = 0.08) {
    const played: [number, number][] = [];
    const wrap = jest.fn();
    const scheduler = new StepScheduler(context, {
      steps,
      stepSec,
      play: (step, at) => played.push([step, Number(at.toFixed(3))]),
      wrap,
    });
    return { scheduler, played, wrap };
  }

  it('hands over the steps a quarter of a second ahead of the clock', () => {
    const { scheduler, played, wrap } = schedule();

    scheduler.start();

    expect(played).toEqual([
      [0, 10.05],
      [1, 10.13],
      [2, 10.21],
    ]);
    expect(wrap).not.toHaveBeenCalled();
    scheduler.stop();
  });

  it('goes on as the clock moves, and says when the loop wraps', () => {
    const { scheduler, played, wrap } = schedule();
    scheduler.start();

    time = 10.25;
    jest.advanceTimersByTime(60);

    expect(played.slice(3)).toEqual([
      [3, 10.29],
      [0, 10.37],
      [1, 10.45],
    ]);
    expect(wrap).toHaveBeenCalledTimes(1);
    scheduler.stop();
  });

  it('starts part way into the loop, on the next step', () => {
    const { scheduler, played } = schedule();

    scheduler.start(0.25);

    // 0.25 s in lies between step 3 (0.24 s) and the next pass's step 0
    // (0.32 s), which is the next one: 0.07 s on, after the 0.05 s lead.
    expect(played[0]).toEqual([0, 10.12]);
    scheduler.stop();
  });

  it('skips what is already late instead of playing it all at once', () => {
    const { scheduler, played } = schedule();
    scheduler.start();
    played.length = 0;

    // A background tab: the clock ran a whole second without a tick.
    time = 11.3;
    jest.advanceTimersByTime(60);

    expect(played.length).toBeLessThanOrEqual(3);
    expect(played.every(([, at]) => at >= 11.3)).toBe(true);
    scheduler.stop();
  });

  it('stops', () => {
    const { scheduler, played } = schedule();
    scheduler.start();
    scheduler.stop();
    played.length = 0;

    time = 20;
    jest.advanceTimersByTime(600);

    expect(played).toEqual([]);
  });
});
