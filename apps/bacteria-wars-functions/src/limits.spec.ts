import { type Firestore, Timestamp } from 'firebase-admin/firestore';
import { BAN_CACHE_MS, RETRY_FOR_MS } from './config';
import { clearBanCache, dayOf, isBanned, tooOldToRetry } from './limits';

describe('tooOldToRetry', () => {
  const at = Date.UTC(2026, 9, 25, 12);

  it('acts on an event for an hour, and drops it after', () => {
    expect(tooOldToRetry(at, at)).toBe(false);
    expect(tooOldToRetry(at, at + RETRY_FOR_MS)).toBe(false);
    expect(tooOldToRetry(at, at + RETRY_FOR_MS + 1)).toBe(true);
  });
});

describe('isBanned', () => {
  const T = Date.UTC(2026, 9, 25, 12);
  let reads = 0;
  /** A Firestore holding one ban, until `until`. */
  const banUntil = (until: number) =>
    ({
      doc: () => ({
        get: async () => {
          reads++;
          return {
            exists: true,
            data: () => ({ until: Timestamp.fromMillis(until) }),
          };
        },
      }),
    }) as unknown as Firestore;

  beforeEach(() => {
    reads = 0;
    clearBanCache();
    jest.spyOn(Date, 'now').mockReturnValue(T);
  });
  afterEach(() => jest.restoreAllMocks());

  it("judges the ban's end at the given instant", async () => {
    const db = banUntil(T - 60_000);
    // An event from before the ban ended, retried after.
    expect(await isBanned(db, 'eve', T - 30 * 60_000)).toBe(true);
    expect(await isBanned(db, 'eve', T)).toBe(false);
    expect(reads).toBe(1);
  });

  it('reads the ban again a minute later by the clock, whatever the instant', async () => {
    const db = banUntil(T + 60 * 60_000);
    await isBanned(db, 'eve', T);
    jest.spyOn(Date, 'now').mockReturnValue(T + BAN_CACHE_MS + 1);
    await isBanned(db, 'eve', T - 30 * 60_000);
    expect(reads).toBe(2);
  });
});

describe('dayOf', () => {
  it('is the UTC day', () => {
    expect(dayOf(Date.UTC(2026, 9, 25, 23, 59))).toBe('2026-10-25');
  });
});
