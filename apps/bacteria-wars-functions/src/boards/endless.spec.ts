import {
  BALANCE_VERSION,
  endlessLevelId,
  endlessSort,
} from '@wolsok/feat-lazy-bac-game/engine';
import {
  type AcceptedMatch,
  computeRun,
  endlessEntryBase,
  LOST_AFTER_MS,
} from './endless-run';

const SEED = 4242;
const HOUR = 3_600_000;
const NOW = Date.UTC(2026, 9, 25, 12);
/** A minute of play. */
const TICKS = 3_600;

/** The level the run is at after `wins` wins. */
const level = (wins: number) => endlessLevelId({ seed: SEED, wins, lives: 3 });
const match = (
  wins: number,
  won: boolean,
  extra: Partial<AcceptedMatch> = {}
): AcceptedMatch => ({
  replayId: `l_${wins}_${won}`,
  levelId: level(wins),
  won,
  ticks: TICKS,
  reason: 'counted',
  atHour: 100 + wins,
  balanceVersion: BALANCE_VERSION,
  ...extra,
});
/** `n` matches declared an hour or more ago. */
const declared = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ i, at: NOW - 10 * HOUR + i }));

describe('computeRun', () => {
  it('counts wins on the levels the run was at, and losses as lives', () => {
    const run = computeRun(
      SEED,
      declared(3),
      { 0: match(0, true), 1: match(1, false), 2: match(1, true) },
      NOW
    );
    expect(run).toMatchObject({
      wins: 2,
      lives: 2,
      over: false,
      pendingAt: null,
    });
    expect(endlessEntryBase(run, 0, null)).toMatchObject({
      atHour: 101,
      show: { depth: 2, seconds: 120 },
    });
    expect(run.matches.map((m) => m.result)).toEqual(['won', 'lost', 'won']);
  });

  it('refuses a match on another level or with failed checks, at a life each', () => {
    const run = computeRun(
      SEED,
      declared(3),
      {
        0: match(0, true, { levelId: level(5) }),
        1: match(0, true, { reason: 'late' }),
        2: match(0, true),
      },
      NOW
    );
    expect(run.matches.map((m) => m.result)).toEqual([
      'refused',
      'refused',
      'won',
    ]);
    expect(run).toMatchObject({ wins: 1, lives: 1 });
  });

  it('loses a life for a match without a replay after 2 hours, waits before', () => {
    const late = computeRun(SEED, declared(2), { 1: match(0, true) }, NOW);
    expect(late.matches.map((m) => m.result)).toEqual(['no-replay', 'won']);
    const fresh = [
      { i: 0, at: NOW - LOST_AFTER_MS + 1 },
      { i: 1, at: NOW },
    ];
    const waiting = computeRun(SEED, fresh, { 1: match(0, true) }, NOW);
    expect(waiting).toMatchObject({ wins: 0, pendingAt: fresh[0].at });
    expect(waiting.matches).toEqual([{ i: 0, result: 'pending' }]);
  });

  it('ends after the third lost life and counts nothing after it', () => {
    const run = computeRun(
      SEED,
      declared(4),
      {
        0: match(0, false),
        1: match(0, false),
        2: match(0, false),
        3: match(0, true),
      },
      NOW
    );
    expect(run).toMatchObject({ wins: 0, lives: 0, over: true });
    expect(run.matches).toHaveLength(3);
  });
});

describe('endlessEntryBase', () => {
  const run = computeRun(
    SEED,
    declared(3),
    {
      0: match(0, true),
      1: match(1, true, { ticks: 2 * TICKS }),
      2: match(2, true),
    },
    NOW
  );

  it('ranks by depth and seconds, provisional until every win is confirmed', () => {
    expect(endlessEntryBase(run, 2, null)).toEqual({
      sort: endlessSort(3, 240),
      atHour: 102,
      baseStatus: 'provisional',
      show: { depth: 3, seconds: 240 },
    });
    expect(endlessEntryBase(run, 3, null)?.baseStatus).toBe('verified');
  });

  it('keeps the verified prefix of a cut run, partly confirmed', () => {
    expect(endlessEntryBase(run, 2, 2)).toEqual({
      sort: endlessSort(2, 180),
      atHour: 101,
      baseStatus: 'verified',
      show: { depth: 2, seconds: 180, partial: true },
    });
  });

  it('has no entry without a win', () => {
    expect(endlessEntryBase(computeRun(SEED, [], {}, NOW), 0, null)).toBeNull();
    expect(endlessEntryBase(run, 0, 0)).toBeNull();
  });
});
