import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  COMEBACK_MS,
  GUEST_IDLE_DAYS,
  GuestVisits,
  localDay,
  NOTICE_DISMISSED_MS,
  noticeDue,
  parseGuestVisits,
  withVisit,
} from './guest-visits';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Noon on 2026-10-26, local time, so a day either way stays a day. */
const NOW = new Date(2026, 9, 26, 12).getTime();

const visits = (part: Partial<GuestVisits> = {}): GuestVisits => ({
  days: 0,
  lastDay: null,
  lastAt: null,
  dismissedAt: null,
  successHintShown: false,
  ...part,
});

describe('parseGuestVisits', () => {
  it('reads what the device stored', () => {
    expect(
      parseGuestVisits({
        days: 4,
        lastDay: '2026-10-25',
        lastAt: NOW - DAY_MS,
        dismissedAt: NOW - 2 * DAY_MS,
        successHintShown: true,
      })
    ).toEqual({
      days: 4,
      lastDay: '2026-10-25',
      lastAt: NOW - DAY_MS,
      dismissedAt: NOW - 2 * DAY_MS,
      successHintShown: true,
    });
  });

  it('keeps what it can read and drops the rest', () => {
    expect(parseGuestVisits({ days: -2, lastDay: 5, lastAt: 'x' })).toEqual(
      visits()
    );
    expect(parseGuestVisits('nonsense')).toEqual(visits());
    expect(parseGuestVisits(null)).toEqual(visits());
  });
});

describe('localDay', () => {
  it("names the device's local date", () => {
    expect(localDay(NOW)).toBe('2026-10-26');
    expect(localDay(new Date(2026, 0, 5, 0, 1).getTime())).toBe('2026-01-05');
  });
});

describe('withVisit', () => {
  it('counts a new day once', () => {
    const first = withVisit(visits(), NOW);
    expect(first).toEqual({
      visits: visits({ days: 1, lastDay: '2026-10-26', lastAt: NOW }),
      cameBack: false,
    });

    const again = withVisit(first.visits, NOW + 60_000);
    expect(again.visits).toBe(first.visits);

    expect(withVisit(first.visits, NOW + DAY_MS).visits.days).toBe(2);
  });

  it('brings a notice put away back after a long pause', () => {
    const before = visits({
      days: 5,
      lastDay: '2026-09-01',
      lastAt: NOW - COMEBACK_MS - DAY_MS,
      dismissedAt: NOW - COMEBACK_MS - DAY_MS,
    });

    const { visits: after, cameBack } = withVisit(before, NOW);

    expect(cameBack).toBe(true);
    expect(after.dismissedAt).toBeNull();
    expect(after.days).toBe(6);
  });

  it('keeps a notice put away after a short pause', () => {
    const before = visits({
      days: 5,
      lastDay: '2026-10-20',
      lastAt: NOW - 6 * DAY_MS,
      dismissedAt: NOW - 6 * DAY_MS,
    });

    const { visits: after, cameBack } = withVisit(before, NOW);

    expect(cameBack).toBe(false);
    expect(after.dismissedAt).toBe(NOW - 6 * DAY_MS);
  });
});

describe('noticeDue', () => {
  it('starts on the third day', () => {
    expect(noticeDue(visits({ days: 2 }), false, NOW)).toBe(false);
    expect(noticeDue(visits({ days: 3 }), false, NOW)).toBe(true);
  });

  it('comes at once after a long pause', () => {
    expect(noticeDue(visits({ days: 2 }), true, NOW)).toBe(true);
  });

  it('stays away for two weeks after "Later"', () => {
    const later = (ago: number) =>
      noticeDue(visits({ days: 9, dismissedAt: NOW - ago }), false, NOW);

    expect(later(DAY_MS)).toBe(false);
    expect(later(NOTICE_DISMISSED_MS)).toBe(true);
    // A clock that was off then keeps it away no longer either.
    expect(later(-DAY_MS)).toBe(false);
    expect(later(-NOTICE_DISMISSED_MS)).toBe(true);
  });
});

describe('GUEST_IDLE_DAYS', () => {
  it("is the days the functions' guest cleanup waits", () => {
    const config = readFileSync(
      join(
        __dirname,
        '../../../../../../../apps/bacteria-wars-functions/src/config.ts'
      ),
      'utf8'
    );

    expect(config).toContain(
      `export const GUEST_IDLE_DAYS = ${GUEST_IDLE_DAYS};`
    );
  });
});
