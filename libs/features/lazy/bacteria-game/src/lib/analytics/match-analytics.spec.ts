import { TestBed } from '@angular/core/testing';
import {
  provideRecordingAnalytics,
  RecordingAnalytics,
} from '@wolsok/shared-analytics/testing';
import {
  LEVELS,
  type MatchEarnings,
  type MatchPlan,
  type Player,
  type RankedOutcome,
} from '@wolsok/feat-shared-bacteria-engine';
import type { MatchKind } from '../state/match-rules';
import {
  MatchAnalytics,
  matchParams,
  MatchState,
  outcomeName,
} from './match-analytics';

const plan = {
  levelId: LEVELS[0].id,
  mode: 'vs-computer',
  difficulty: 'normal',
} as MatchPlan;

const local: MatchState = {
  online: null,
  ranked: null,
  kind: 'vs-computer',
  endlessRanked: null,
  timePassed: 0,
};

const cpu = { kind: 'cpu', ruleset: 'cpu' } as const;
const human = { id: 0, isBot: false } as Player;
const bot = { id: 1, isBot: true } as Player;

function earnings(changes: Partial<MatchEarnings> = {}): MatchEarnings {
  return {
    award: null,
    achievements: [],
    xp: { parts: [], total: 0 },
    xpBefore: 0,
    unlocked: [],
    cosmetics: [],
    ...changes,
  };
}

describe('MatchAnalytics', () => {
  let analytics: RecordingAnalytics;
  let matches: MatchAnalytics;

  beforeEach(() => {
    analytics = new RecordingAnalytics();
    TestBed.configureTestingModule({
      providers: [provideRecordingAnalytics(analytics)],
    });
    matches = TestBed.inject(MatchAnalytics);
  });

  const started = {
    level_name: LEVELS[0].id,
    kind: 'vs_computer',
    difficulty: 'normal',
    ranked: false,
    simulation: 'cpu',
    ruleset: 'cpu',
  };

  it('counts the start and the end of a match, with what it earned', () => {
    matches.started(plan, local, cpu);
    matches.ended(
      { winner: human, reason: 'annihilation' },
      { ...local, timePassed: 61_400 },
      earnings({
        award: {
          medal: 'gold',
          previousBest: 'bronze',
        } as MatchEarnings['award'],
        achievements: ['first-blood'] as MatchEarnings['achievements'],
        xp: { parts: [], total: 140 },
        unlocked: ['next-level'],
      })
    );

    expect(analytics.events).toEqual([
      { name: 'level_start', params: started },
      {
        name: 'level_end',
        params: {
          ...started,
          success: true,
          outcome: 'win',
          reason: 'annihilation',
          duration_sec: 61,
          medal: 'gold',
          new_best: true,
          achievements: 1,
          levels_unlocked: 1,
          xp: 140,
          mission_done: undefined,
        },
      },
      { name: 'unlock_achievement', params: { achievement_id: 'first-blood' } },
    ]);
  });

  it('counts a new rank the match climbed to', () => {
    matches.started(plan, local, cpu);
    matches.ended(
      { winner: bot, reason: 'time' },
      { ...local, timePassed: 1000 },
      earnings({ xpBefore: 0, xp: { parts: [], total: 100_000 } })
    );

    expect(analytics.tracked('level_up')).toEqual([
      expect.objectContaining({ level: expect.any(Number) }),
    ]);
    expect(analytics.tracked('level_end')[0]).toMatchObject({
      success: false,
      outcome: 'loss',
      new_best: false,
    });
  });

  it('counts a match left before it ended, once', () => {
    matches.started(plan, local, cpu);

    matches.left(12_000);
    matches.left(0);

    expect(analytics.tracked('match_abandoned')).toEqual([
      { ...started, duration_sec: 12 },
    ]);
  });

  it('counts a restart as leaving the match under way, after its time', () => {
    matches.started(plan, local, cpu);
    matches.started(plan, { ...local, timePassed: 95_000 }, cpu);

    expect(analytics.tracked('match_abandoned')).toEqual([
      { ...started, duration_sec: 95 },
    ]);

    expect(analytics.events.map(({ name }) => name)).toEqual([
      'level_start',
      'match_abandoned',
      'level_start',
    ]);
  });

  it('leaves nothing to abandon once the match ended', () => {
    matches.started(plan, local, cpu);
    matches.ended(
      { winner: null, reason: 'time' },
      { ...local, timePassed: 0 },
      null
    );
    matches.left(0);

    expect(analytics.tracked('match_abandoned')).toEqual([]);
    expect(analytics.tracked('level_end')[0]).toMatchObject({
      outcome: 'draw',
      medal: 'none',
      xp: 0,
    });
  });
});

describe('matchParams', () => {
  it.each<[MatchKind, string]>([
    ['vs-computer', 'vs_computer'],
    ['two-players', 'two_players'],
    ['ghost', 'ghost'],
    ['training', 'training'],
    ['daily', 'daily'],
    ['endless', 'endless'],
    ['online', 'online'],
  ])('names a %s match %s', (kind, name) => {
    expect(matchParams(plan, { ...local, kind }, cpu).kind).toBe(name);
  });

  it('names the ruleset of the float GPU, which has none', () => {
    expect(
      matchParams(plan, local, { kind: 'gpu', ruleset: null })
    ).toMatchObject({ simulation: 'gpu', ruleset: 'float' });
  });

  it('says whether the match is ranked', () => {
    const practice: RankedOutcome = {
      match: null,
      note: { kind: 'unranked', reason: 'offline' },
    };
    const daily: MatchState = {
      ...local,
      kind: 'daily',
      ranked: practice,
    };
    expect(matchParams(plan, daily, cpu).ranked).toBe(true);
    expect(matchParams(plan, local, cpu).ranked).toBe(false);
  });

  it('counts every match of a ranked endless run as ranked', () => {
    const endless: MatchState = {
      ...local,
      kind: 'endless',
      endlessRanked: { runId: 'r', next: 2 },
    };
    expect(matchParams(plan, endless, cpu).ranked).toBe(true);
  });

  it('gives no difficulty between two players', () => {
    expect(
      matchParams({ ...plan, mode: 'two-players' }, local, cpu).difficulty
    ).toBe('none');
  });
});

describe('outcomeName', () => {
  const online = {
    online: {
      seat: 1 as const,
      levelId: 'x',
      colors: ['a', 'b'] as [string, string],
    },
  };

  it("judges an online match by this device's seat", () => {
    expect(outcomeName(bot, 'online', online)).toBe('win');
    expect(outcomeName(human, 'online', online)).toBe('loss');
  });

  it('calls a match between two players decided', () => {
    expect(outcomeName(human, 'two_players', local)).toBe('decided');
  });
});
