import { isRerunState, mayRerun, RERUN_RESULTS, verdictOf } from './model';

describe('replay states', () => {
  it('tells the states a re-run leaves, and what they mean for a board', () => {
    expect(RERUN_RESULTS.every(isRerunState)).toBe(true);
    expect(isRerunState('agreed')).toBe(false);
    expect(verdictOf('verified')).toBe('verified');
    expect(verdictOf('unverified')).toBe('failed');
    expect(verdictOf('balance-mismatch')).toBe('failed');
    expect(verdictOf('submitted')).toBeNull();
  });

  it('re-runs a local replay, or an online one with both reports', () => {
    expect(mayRerun({ state: 'submitted' })).toBe(true);
    expect(mayRerun({ state: 'agreed' })).toBe(true);
    expect(mayRerun({ state: 'disputed' })).toBe(true);
    expect(mayRerun({ state: 'waiting' })).toBe(false);
    expect(mayRerun({ state: 'verified' })).toBe(false);
  });
});
