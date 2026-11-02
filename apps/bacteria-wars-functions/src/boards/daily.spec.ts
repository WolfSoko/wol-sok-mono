import { type ReplayHeader } from '@wolsok/feat-lazy-bac-game/engine';
import { AT, ATTEMPT, dailyReplay, TICKS, UID } from '../testing/daily-replay';
import {
  checkDailyAttempt,
  type DailyAttemptRun,
  dailyEntryBase,
} from './rank-daily';
import { openDays, trustOf } from './verify-slice';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** A minute after the match ended. */
const ARRIVED = AT + 5_000 + 60_000 + 60_000;

describe('checkDailyAttempt', () => {
  it('counts a ranked replay of a declared attempt, in time', () => {
    expect(checkDailyAttempt(dailyReplay(), UID, ATTEMPT, AT, ARRIVED)).toBe(
      'counted'
    );
  });

  it('takes the declaration, never the header, for the seed', () => {
    expect(
      checkDailyAttempt(dailyReplay(), UID, ATTEMPT, AT + 1, ARRIVED)
    ).toBe('seed');
    expect(checkDailyAttempt(dailyReplay(), 'bob', ATTEMPT, AT, ARRIVED)).toBe(
      'seed'
    );
  });

  it('refuses another ruleset, setup or level', () => {
    const replay = (header: Partial<ReplayHeader>) =>
      checkDailyAttempt(dailyReplay(header), UID, ATTEMPT, AT, ARRIVED);
    expect(replay({ simulation: 'cpu' })).toBe('ruleset');
    expect(replay({ difficulty: 'easy' })).toBe('plan-mismatch');
    expect(replay({ headStart: 2 })).toBe('plan-mismatch');
    expect(replay({ levelId: 'quarantine' })).toBe('level');
  });

  it('refuses a match played before its declaration, or sent too late', () => {
    // A minute of play cannot arrive 10 s after the declaration.
    expect(
      checkDailyAttempt(
        dailyReplay({ ticks: 3 * TICKS }),
        UID,
        ATTEMPT,
        AT,
        AT + 10_000
      )
    ).toBe('early');
    expect(
      checkDailyAttempt(
        dailyReplay(),
        UID,
        ATTEMPT,
        AT,
        AT + 6 * 60_000 + 6_000
      )
    ).toBe('late');
  });

  it('wants a daily attempt', () => {
    expect(
      checkDailyAttempt(dailyReplay(), UID, 'e_202610251_0', AT, ARRIVED)
    ).toBe('no-attempt');
  });
});

describe('dailyEntryBase', () => {
  const run = (extra: Partial<DailyAttemptRun>): DailyAttemptRun => ({
    attemptId: ATTEMPT,
    replayId: 'l_1',
    sort: 10,
    won: false,
    ticks: 10,
    state: 'provisional',
    atHour: 5,
    ...extra,
  });

  it("is the best attempt that has not failed, with that attempt's status", () => {
    expect(
      dailyEntryBase([
        run({ sort: 30, state: 'unverified' }),
        run({ sort: 20, state: 'verified', won: true, ticks: 900 }),
        run({ sort: 10 }),
      ])
    ).toEqual({
      sort: 20,
      atHour: 5,
      baseStatus: 'verified',
      show: { ticks: 900, won: true },
    });
  });

  it('prefers the earlier of two equal scores, and is null with none left', () => {
    expect(
      dailyEntryBase([run({ atHour: 9 }), run({ atHour: 3 })])?.atHour
    ).toBe(3);
    expect(dailyEntryBase([run({ state: 'balance-mismatch' })])).toBeNull();
  });
});

describe('trustOf', () => {
  const NOW = Date.UTC(2026, 9, 25, 12);
  it('checks old Google accounts and verified players first, fresh ones last', () => {
    expect(
      trustOf({ createdAt: NOW - 8 * DAY, google: true }, false, NOW)
    ).toBe(0);
    expect(trustOf({ createdAt: NOW - HOUR, google: false }, true, NOW)).toBe(
      0
    );
    expect(
      trustOf({ createdAt: NOW - 4 * DAY, google: true }, false, NOW)
    ).toBe(1);
    expect(
      trustOf({ createdAt: NOW - 4 * DAY, google: false }, false, NOW)
    ).toBe(1);
    expect(trustOf({ createdAt: NOW - DAY, google: true }, false, NOW)).toBe(2);
    expect(trustOf({ createdAt: null, google: true }, false, NOW)).toBe(2);
  });
});

describe('openDays', () => {
  it("checks yesterday's board until 23:00 UTC", () => {
    expect(openDays(Date.UTC(2026, 9, 25, 22, 59))).toEqual([
      '2026-10-25',
      '2026-10-24',
    ]);
    expect(openDays(Date.UTC(2026, 9, 25, 23))).toEqual(['2026-10-25']);
  });
});
