import { TestBed } from '@angular/core/testing';
import {
  provideRecordingAnalytics,
  RecordingAnalytics,
} from '@wolsok/shared-analytics/testing';
import type { MatchEarnings } from '../state/earnings';
import { LEVELS } from '../state/levels';
import type { MatchPlan } from '../state/match-setup';
import type { Player } from '../state/player.model';
import type { RankedOutcome } from '../state/ranked-match';
import type { Replay } from '../state/replay';
import {
  MatchAnalytics,
  matchKind,
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
  ghost: null,
  dailyDay: null,
  endlessMatch: false,
  ranked: null,
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

describe('matchKind', () => {
  it.each([
    [{ online: { seat: 0, levelId: 'x', colors: ['a', 'b'] } }, 'online'],
    [{ ghost: {} as Replay }, 'ghost'],
    [{ dailyDay: '2026-10-31' }, 'daily'],
    [{ endlessMatch: true }, 'endless'],
  ] as [Partial<MatchState>, string][])(
    'tells %o a %s match',
    (state, kind) => {
      expect(matchKind(plan, { ...local, ...state })).toBe(kind);
    }
  );

  it('tells a training mission by its level', () => {
    expect(matchKind({ ...plan, levelId: 'training-steer' }, local)).toBe(
      'training'
    );
  });

  it('tells a match against the computer, on the ladder or free', () => {
    expect(matchKind(plan, local)).toBe('vs_computer');
  });

  it('tells two players at one device', () => {
    expect(matchKind({ ...plan, mode: 'two-players' }, local)).toBe(
      'two_players'
    );
  });
});

describe('matchParams', () => {
  it('names the ruleset of the float GPU, which has none', () => {
    expect(
      matchParams(plan, local, { kind: 'gpu', ruleset: null })
    ).toMatchObject({ simulation: 'gpu', ruleset: 'float' });
  });

  it('says whether the match is ranked', () => {
    expect(
      matchParams(plan, { ...local, ranked: {} as RankedOutcome }, cpu).ranked
    ).toBe(true);
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
