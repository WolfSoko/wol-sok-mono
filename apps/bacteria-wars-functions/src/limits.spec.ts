import { RETRY_FOR_MS } from './config';
import { dayOf, tooOldToRetry } from './limits';

describe('tooOldToRetry', () => {
  const at = Date.UTC(2026, 9, 25, 12);
  const time = new Date(at).toISOString();

  it('acts on an event for an hour, and drops it after', () => {
    expect(tooOldToRetry(time, at)).toBe(false);
    expect(tooOldToRetry(time, at + RETRY_FOR_MS)).toBe(false);
    expect(tooOldToRetry(time, at + RETRY_FOR_MS + 1)).toBe(true);
  });
});

describe('dayOf', () => {
  it('is the UTC day', () => {
    expect(dayOf(Date.UTC(2026, 9, 25, 23, 59))).toBe('2026-10-25');
  });
});
