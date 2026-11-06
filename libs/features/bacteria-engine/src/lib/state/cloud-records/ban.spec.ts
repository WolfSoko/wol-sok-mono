import {
  banHolds,
  mirroredBan,
  parseBan,
  parseMirroredBan,
  type ToMillis,
} from './ban';

/** A stored time as the sides hand it over: here, a number of ms. */
const toMillis: ToMillis = (value) =>
  typeof value === 'number' ? value : null;

describe('parseBan', () => {
  it('reads a ban as the functions store it', () => {
    expect(parseBan({ since: 1, until: 9, reason: 'spam' }, toMillis)).toEqual({
      since: 1,
      until: 9,
      reason: 'spam',
    });
  });

  it('reads a null until as a ban for good', () => {
    expect(
      parseBan({ since: 1, until: null, reason: 'cheating' }, toMillis)
    ).toEqual({ since: 1, until: null, reason: 'cheating' });
  });

  it('reads a missing or damaged until as a ban for good, as the rules do', () => {
    expect(parseBan({ since: 1, reason: 'spam' }, toMillis)?.until).toBeNull();
    expect(
      parseBan({ since: 1, until: 'soon', reason: 'spam' }, toMillis)?.until
    ).toBeNull();
  });

  it('reads an unreadable start or reason as null', () => {
    expect(
      parseBan({ since: 'x', until: 9, reason: 'rude' }, toMillis)
    ).toEqual({ since: null, until: 9, reason: null });
  });

  it('reads no document as no ban', () => {
    expect(parseBan(undefined, toMillis)).toBeNull();
    expect(parseBan(null, toMillis)).toBeNull();
  });

  it('maps times through the side given', () => {
    const timestamp = (ms: number) => ({ toMillis: () => ms });
    const fromTimestamp: ToMillis = (value) =>
      typeof value === 'object' && value !== null && 'toMillis' in value
        ? (value as { toMillis: () => number }).toMillis()
        : null;
    expect(
      parseBan(
        { since: timestamp(1), until: timestamp(9), reason: 'other' },
        fromTimestamp
      )
    ).toEqual({ since: 1, until: 9, reason: 'other' });
  });
});

describe('banHolds', () => {
  it('holds until its end, exclusive', () => {
    expect(banHolds({ until: 101 }, 100)).toBe(true);
    expect(banHolds({ until: 100 }, 100)).toBe(false);
    expect(banHolds({ until: 99 }, 100)).toBe(false);
  });

  it('always holds for good, and never without a ban', () => {
    expect(banHolds({ until: null }, Number.MAX_SAFE_INTEGER)).toBe(true);
    expect(banHolds(null, 0)).toBe(false);
  });
});

describe('the mirrored ban', () => {
  it('writes the end in ms, 0 for good', () => {
    expect(mirroredBan(9)).toBe(9);
    expect(mirroredBan(null)).toBe(0);
  });

  it('reads back what it wrote', () => {
    expect(parseMirroredBan(mirroredBan(9))).toEqual({
      since: null,
      until: 9,
      reason: null,
    });
    expect(parseMirroredBan(mirroredBan(null))?.until).toBeNull();
  });

  it('reads no value, or one that is no end, as no ban', () => {
    for (const value of [null, undefined, -1, Number.NaN, Infinity, '9']) {
      expect(parseMirroredBan(value)).toBeNull();
    }
  });

  it('holds by the same rule as the stored ban', () => {
    expect(banHolds(parseMirroredBan(100), 100)).toBe(false);
    expect(banHolds(parseMirroredBan(101), 100)).toBe(true);
    expect(banHolds(parseMirroredBan(0), 100)).toBe(true);
  });
});
