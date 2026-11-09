import { hours, hToMs } from '@wolsok/utils-time';
import { TOMBSTONE_DURATION_MS } from './account';

describe('the account constants', () => {
  it('keep a tombstone longer than an ID token of the account lives', () => {
    expect(TOMBSTONE_DURATION_MS).toBeGreaterThan(hToMs(hours(1)));
  });
});
