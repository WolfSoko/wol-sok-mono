import { COUNTDOWN_MS } from '@wolsok/feat-shared-bacteria-engine';
import {
  COUNTDOWN_STEP_MS,
  DEFAULT_MATCH_COUNTDOWN_SECONDS,
} from './match-countdown';

describe('the match countdown', () => {
  it('fits the countdown a ranked attempt allows for', () => {
    expect(
      DEFAULT_MATCH_COUNTDOWN_SECONDS * COUNTDOWN_STEP_MS
    ).toBeLessThanOrEqual(COUNTDOWN_MS);
  });

  it('counts at least one second', () => {
    expect(DEFAULT_MATCH_COUNTDOWN_SECONDS).toBeGreaterThan(0);
  });
});
