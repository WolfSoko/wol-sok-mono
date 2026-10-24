import {
  DETERMINISTIC_REPORT_LAG,
  divideBudgetOf,
  PendingReadback,
  readbacksToTake,
} from './int-readback';

function pending(
  ...steps: [step: number, ready: boolean, stale?: boolean][]
): PendingReadback[] {
  return steps.map(([step, ready, stale = false]) => ({ step, ready, stale }));
}

describe('readbacksToTake', () => {
  it('takes the finished read backs up to the first unfinished one, without a lag', () => {
    expect(
      readbacksToTake(pending([4, true], [5, true], [6, false]), 7, null)
    ).toBe(2);
    expect(readbacksToTake(pending([4, false], [5, true]), 7, null)).toBe(0);
  });

  it('takes every report old enough with a lag, finished or not', () => {
    const queue = pending([3, false], [4, false], [5, true]);
    expect(readbacksToTake(queue, 7, DETERMINISTIC_REPORT_LAG)).toBe(2);
    expect(readbacksToTake(queue, 6, DETERMINISTIC_REPORT_LAG)).toBe(1);
    expect(readbacksToTake(queue, 5, DETERMINISTIC_REPORT_LAG)).toBe(0);
  });

  it('frees the read backs of an earlier match first', () => {
    const queue = pending([90, false, true], [91, true, true], [1, false]);
    expect(readbacksToTake(queue, 2, DETERMINISTIC_REPORT_LAG)).toBe(2);
    expect(readbacksToTake(queue, 4, DETERMINISTIC_REPORT_LAG)).toBe(3);
  });

  it('takes nothing from an empty queue', () => {
    expect(readbacksToTake([], 10, DETERMINISTIC_REPORT_LAG)).toBe(0);
    expect(readbacksToTake([], 10, null)).toBe(0);
  });
});

describe('divideBudgetOf', () => {
  it('shares the room left among the bacteria and the ticks behind', () => {
    expect(divideBudgetOf(100, 20, 3)).toBe(80 / (20 * 4));
  });

  it('gives nothing to a colony at or over its capacity', () => {
    expect(divideBudgetOf(100, 100, 3)).toBe(0);
    expect(divideBudgetOf(100, 120, 3)).toBe(0);
  });

  it('counts a colony of none as one', () => {
    expect(divideBudgetOf(10, 0, 1)).toBe(10 / 2);
  });
});
