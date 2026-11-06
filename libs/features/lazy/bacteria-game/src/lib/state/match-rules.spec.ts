import {
  dailyLevelId,
  LEVELS,
  missionById,
  type RankedOutcome,
  rankedPlan,
  replayOf,
} from '@wolsok/feat-shared-bacteria-engine';
import {
  matchRules,
  MatchRules,
  NextMatch,
  nextMatchOf,
  OneMatch,
  canRaceAsGhost,
  rematchOf,
  RulesSetup,
  SETUP_MATCH,
} from './match-rules';
import type { OnlineSeat } from './game.states';

const DAY = '2026-11-06';
const GHOST_LEVEL = LEVELS[2].id;
const run = replayOf(
  rankedPlan(GHOST_LEVEL, 7),
  'cpu',
  0,
  { steers: [], drags: [], boosts: [], weapons: [] },
  {},
  false
);
const declared: RankedOutcome = {
  match: { attempt: { id: `d_${DAY}_1`, at: 0 }, seed: 3 },
  note: { kind: 'daily', n: 1 },
};
const practice: RankedOutcome = {
  match: null,
  note: { kind: 'unranked', reason: 'offline' },
};
const host: OnlineSeat = {
  seat: 0,
  levelId: LEVELS[1].id,
  colors: ['a', 'b'],
};
const guest: OnlineSeat = { ...host, seat: 1 };

const vsComputer: RulesSetup = {
  levelId: LEVELS[0].id,
  mode: 'vs-computer',
  seriesLength: 1,
};
const couch: RulesSetup = { ...vsComputer, mode: 'two-players' };
const couchSeries: RulesSetup = { ...couch, seriesLength: 3 };

const daily = (ranked: RankedOutcome | null): OneMatch => ({
  kind: 'daily',
  day: DAY,
  levelId: dailyLevelId(DAY),
  ranked,
});
const endless = (ranked: RankedOutcome | null): OneMatch => ({
  kind: 'endless',
  levelId: 'gen:1',
  ranked,
});

/** The rules of a plain match against the computer on the setup's level. */
const plain: MatchRules = {
  kind: 'vs-computer',
  levelId: vsComputer.levelId,
  planMode: 'vs-computer',
  mission: null,
  recording: 'local',
  evolves: true,
  earns: true,
  inSeries: false,
  rankedMatch: null,
  ranked: null,
  canPause: true,
  canRestart: true,
  onlineGrid: false,
  locks: 'campaign',
};

describe('matchRules', () => {
  it.each<[string, NextMatch, RulesSetup, Partial<MatchRules>]>([
    ['the setup against the computer', SETUP_MATCH, vsComputer, {}],
    [
      'the setup between two players',
      SETUP_MATCH,
      couch,
      {
        kind: 'two-players',
        planMode: 'two-players',
        recording: 'none',
        evolves: false,
      },
    ],
    [
      'a series between two players',
      SETUP_MATCH,
      couchSeries,
      {
        kind: 'two-players',
        planMode: 'two-players',
        recording: 'none',
        evolves: false,
        inSeries: true,
      },
    ],
    [
      'a ghost, on its own level and vs the computer whatever the mode',
      { kind: 'ghost', run },
      couchSeries,
      {
        kind: 'ghost',
        levelId: GHOST_LEVEL,
        recording: 'none',
        earns: false,
      },
    ],
    [
      'a training mission',
      { kind: 'mission', mission: 'feed' },
      couch,
      {
        kind: 'training',
        levelId: missionById('feed').levelId,
        mission: 'feed',
        recording: 'none',
        evolves: false,
      },
    ],
    [
      'a daily match played as practice',
      daily(null),
      couchSeries,
      { kind: 'daily', levelId: dailyLevelId(DAY), evolves: false },
    ],
    [
      'a daily match that could not be ranked',
      daily(practice),
      vsComputer,
      {
        kind: 'daily',
        levelId: dailyLevelId(DAY),
        evolves: false,
        ranked: practice,
      },
    ],
    [
      'a ranked daily attempt',
      daily(declared),
      vsComputer,
      {
        kind: 'daily',
        levelId: dailyLevelId(DAY),
        evolves: false,
        recording: 'ranked',
        rankedMatch: declared.match,
        ranked: declared,
        canPause: false,
        canRestart: false,
        onlineGrid: true,
      },
    ],
    [
      'an endless match',
      endless(null),
      vsComputer,
      {
        kind: 'endless',
        levelId: 'gen:1',
        evolves: false,
        canRestart: false,
      },
    ],
    [
      'a ranked endless match',
      endless(declared),
      vsComputer,
      {
        kind: 'endless',
        levelId: 'gen:1',
        evolves: false,
        recording: 'ranked',
        rankedMatch: declared.match,
        ranked: declared,
        canPause: false,
        canRestart: false,
        onlineGrid: true,
      },
    ],
    [
      'online as the host',
      { kind: 'online', seat: host },
      couchSeries,
      {
        kind: 'online',
        levelId: host.levelId,
        planMode: 'two-players',
        recording: 'online',
        evolves: false,
        earns: false,
        onlineGrid: true,
        locks: 'online',
      },
    ],
    [
      'online as the guest, who cannot restart',
      { kind: 'online', seat: guest },
      vsComputer,
      {
        kind: 'online',
        levelId: guest.levelId,
        planMode: 'two-players',
        recording: 'online',
        evolves: false,
        earns: false,
        canRestart: false,
        onlineGrid: true,
        locks: 'online',
      },
    ],
  ])('%s', (_, next, setup, differences) => {
    expect(matchRules(next, setup)).toEqual({ ...plain, ...differences });
  });
});

describe('nextMatchOf', () => {
  it('is the one-match setting outside an online match', () => {
    expect(nextMatchOf(daily(null), null)).toEqual(daily(null));
  });

  it('is the online match while a seat is taken, whatever was set', () => {
    expect(nextMatchOf(daily(null), host)).toEqual({
      kind: 'online',
      seat: host,
    });
  });
});

describe('canRaceAsGhost', () => {
  it('takes a run against the computer', () => {
    expect(canRaceAsGhost(run)).toBe(true);
  });

  it("refuses one between two players, or on a training mission's level", () => {
    expect(
      canRaceAsGhost({ ...run, header: { ...run.header, mode: 'two-players' } })
    ).toBe(false);
    expect(
      canRaceAsGhost({
        ...run,
        header: { ...run.header, levelId: missionById('steer').levelId },
      })
    ).toBe(false);
  });
});

describe('rematchOf', () => {
  it('plays a daily or endless match again unranked: a rematch declares anew', () => {
    expect(rematchOf(daily(declared))).toEqual(daily(null));
    expect(rematchOf(endless(practice))).toEqual(endless(null));
  });

  it('keeps any other match as it was', () => {
    const ghost: OneMatch = { kind: 'ghost', run };
    expect(rematchOf(ghost)).toBe(ghost);
  });
});
