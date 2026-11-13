import { withTimeout } from './timeout';

describe('mitZeitlimit', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('gives what the work gives in time, and leaves no timer', async () => {
    const result = withTimeout(Promise.resolve(true), 5000, () => false);

    await expect(result).resolves.toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('gives what the timeout gives once the work takes longer', async () => {
    const result = withTimeout(
      new Promise<boolean>(() => undefined),
      5000,
      () => false
    );

    await vi.advanceTimersByTimeAsync(5000);

    await expect(result).resolves.toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('passes the failure of the work on, and leaves no timer', async () => {
    const result = withTimeout(Promise.reject(new Error('weg')), 5000, () => 1);

    await expect(result).rejects.toThrow('weg');
    expect(vi.getTimerCount()).toBe(0);
  });
});
