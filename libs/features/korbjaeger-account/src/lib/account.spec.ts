import {
  FIRESTORE_REGION,
  TOMBSTONE_DAYS,
  TOMBSTONE_DURATION_MS,
} from './account';

const HOUR_MS = 60 * 60 * 1000;

describe('the account constants', () => {
  it('keep a tombstone longer than an ID token of the account lives', () => {
    expect(TOMBSTONE_DURATION_MS).toBeGreaterThan(HOUR_MS);
  });

  it('give the tombstone’s duration in days and milliseconds alike', () => {
    expect(TOMBSTONE_DURATION_MS).toBe(TOMBSTONE_DAYS * 24 * HOUR_MS);
  });

  it('name the region Google calls it by', () => {
    expect(FIRESTORE_REGION.id).toMatch(/^[a-z]+-[a-z]+\d$/);
  });
});
