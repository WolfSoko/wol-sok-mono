import type { League } from './league';
import type { Participant } from './participant';
import {
  outcomeOf,
  dateInGermany,
  resultOf,
  resultProvisional,
  opponentOf,
  sideOf,
  isDecided,
  irregularityOf,
  compareTipOff,
  type Game,
} from './game';

const US: Participant = {
  kind: 'team',
  team: { id: 313036, name: 'MTV Wasbüttel', clubId: 1837 },
};
const GIFHORN: Participant = {
  kind: 'team',
  team: { id: 201500, name: 'MTV Gifhorn', clubId: 1 },
};
const SLOT: Participant = { kind: 'open', label: 'Nord 1. Platz' };

function game(overrides: Partial<Game>): Game {
  return {
    id: 1,
    leagueId: 54862,
    matchday: 1,
    date: '2026-09-20',
    home: US,
    away: GIFHORN,
    status: { kind: 'scheduled' },
    ...overrides,
  };
}

describe('sideOf', () => {
  it('finds the Team at home or away', () => {
    expect(sideOf(game({}), 313036)).toBe('home');
    expect(sideOf(game({ home: GIFHORN, away: US }), 313036)).toBe('away');
  });

  it('finds no side for a Team that does not play', () => {
    expect(sideOf(game({ home: GIFHORN, away: SLOT }), 313036)).toBe(undefined);
  });
});

describe('opponentOf', () => {
  it('names the other side', () => {
    expect(opponentOf(game({ away: SLOT }), 'home')).toBe(SLOT);
    expect(opponentOf(game({}), 'away')).toBe(US);
  });
});

describe('resultOf', () => {
  it('has the result of a played Spiel', () => {
    expect(
      resultOf(
        game({
          status: {
            kind: 'played',
            result: { home: 78, away: 47 },
            confirmed: true,
          },
        })
      )
    ).toEqual({ home: 78, away: 47 });
  });

  it('has the result of a forfeit where the DBB gives one', () => {
    expect(
      resultOf(
        game({
          status: {
            kind: 'forfeited',
            forfeitedBy: ['away'],
            result: { home: 20, away: 0 },
          },
        })
      )
    ).toEqual({ home: 20, away: 0 });
    expect(
      resultOf(game({ status: { kind: 'forfeited', forfeitedBy: [] } }))
    ).toBeUndefined();
  });

  it.each([{ kind: 'scheduled' }, { kind: 'cancelled' }] as const)(
    'has none while $art',
    (status) => {
      expect(resultOf(game({ status }))).toBeUndefined();
    }
  );
});

describe('irregularityOf', () => {
  it('tells a cancelled and a forfeited Spiel', () => {
    expect(irregularityOf(game({ status: { kind: 'cancelled' } }))).toBe(
      'cancelled'
    );
    expect(
      irregularityOf(game({ status: { kind: 'forfeited', forfeitedBy: [] } }))
    ).toBe('forfeited');
  });

  it('finds nothing special in a planned or played Spiel', () => {
    expect(irregularityOf(game({}))).toBeUndefined();
    expect(
      irregularityOf(
        game({
          status: {
            kind: 'played',
            result: { home: 1, away: 0 },
            confirmed: false,
          },
        })
      )
    ).toBeUndefined();
  });
});

describe('dateInGermany', () => {
  it.each([
    ['2026-11-08T12:00:00Z', '2026-11-08'],
    // after midnight in Germany, still the day before in UTC
    ['2026-11-08T23:30:00Z', '2026-11-09'],
    ['2026-07-31T22:30:00Z', '2026-08-01'],
    ['2026-11-08T22:59:00Z', '2026-11-08'],
    ['2027-01-05T08:00:00Z', '2027-01-05'],
  ])('dates %s as the DBB does: %s', (moment, date) => {
    expect(dateInGermany(new Date(moment))).toBe(date);
  });
});

describe('compareTipOff', () => {
  function tipOff(date: string, time?: string): Game {
    return {
      id: 1,
      leagueId: 1,
      matchday: 1,
      date,
      ...(time && { time }),
      home: US,
      away: GIFHORN,
      status: { kind: 'scheduled' },
    };
  }

  function sequence(...games: Game[]): readonly string[] {
    return [...games]
      .sort(compareTipOff)
      .map(({ date, time }) => `${date} ${time ?? 'open'}`);
  }

  it('orders by day, then by tip-off', () => {
    expect(
      sequence(
        tipOff('2026-11-15', '09:00'),
        tipOff('2026-11-14', '15:30'),
        tipOff('2026-11-14', '09:30')
      )
    ).toEqual(['2026-11-14 09:30', '2026-11-14 15:30', '2026-11-15 09:00']);
  });

  it('puts a Spiel without a tip-off last on its day', () => {
    expect(
      sequence(
        tipOff('2026-11-15', '09:00'),
        tipOff('2026-11-14'),
        tipOff('2026-11-14', '15:30')
      )
    ).toEqual(['2026-11-14 15:30', '2026-11-14 open', '2026-11-15 09:00']);
  });

  it('ties Spiele of one tip-off', () => {
    expect(compareTipOff(tipOff('2026-11-14'), tipOff('2026-11-14'))).toBe(0);
  });
});

describe('resultProvisional', () => {
  const KREISLIGA: League = {
    id: 54862,
    name: 'U12 Kreisliga',
    association: { id: 7, name: 'Niedersachsen' },
    ageGroup: 'U12',
    gender: 'mixed',
    division: 'Kreisliga',
  };
  const BBL: League = {
    ...KREISLIGA,
    name: '1. Bundesliga (easyCredit BBL)',
    association: { id: 100, name: 'Bundesligen' },
    withoutGameReports: true,
    resultsNeverConfirmed: true,
  };
  const UNCONFIRMED = game({
    status: {
      kind: 'played',
      result: { home: 78, away: 47 },
      confirmed: false,
    },
  });

  it.each([
    ['its Liga', KREISLIGA],
    ['a Liga the Saison does not list', undefined],
  ])(
    'holds for a played Spiel the Verband has not confirmed yet, with %s',
    (_case, league) => {
      expect(resultProvisional(UNCONFIRMED, league)).toBe(true);
    }
  );

  it('does not hold in a Liga whose results the DBB never confirms', () => {
    expect(resultProvisional(UNCONFIRMED, BBL)).toBe(false);
  });

  it.each([
    [
      'a confirmed result',
      { kind: 'played', result: { home: 78, away: 47 }, confirmed: true },
    ],
    ['a planned Spiel', { kind: 'scheduled' }],
    ['a cancelled Spiel', { kind: 'cancelled' }],
    [
      'a forfeit',
      {
        kind: 'forfeited',
        forfeitedBy: ['away'],
        result: { home: 20, away: 0 },
      },
    ],
  ] as const)('does not hold for %s', (_case, status) => {
    expect(resultProvisional(game({ status }), KREISLIGA)).toBe(false);
  });
});

describe('isDecided', () => {
  it.each([
    [{ kind: 'played', result: { home: 1, away: 0 }, confirmed: true }, true],
    [{ kind: 'forfeited', forfeitedBy: [] }, true],
    [{ kind: 'scheduled' }, false],
    [{ kind: 'cancelled' }, false],
  ] as const)('%o: %s', (status, decided) => {
    expect(
      isDecided({
        id: 1,
        leagueId: 1,
        matchday: 1,
        date: '2026-11-14',
        home: US,
        away: GIFHORN,
        status,
      })
    ).toBe(decided);
  });
});

describe('outcomeOf', () => {
  const played = (home: number, away: number): Game['status'] => ({
    kind: 'played',
    result: { home, away },
    confirmed: true,
  });

  it('tells a win from a loss from either side', () => {
    const gameWith = game({ status: played(78, 47) });

    expect(outcomeOf(gameWith, 'home')).toBe('win');
    expect(outcomeOf(gameWith, 'away')).toBe('loss');
  });

  it('has none for equal points: basketball has no draws, so no result yet', () => {
    expect(outcomeOf(game({ status: played(0, 0) }), 'home')).toBeUndefined();
    expect(
      outcomeOf(
        game({
          status: {
            kind: 'forfeited',
            forfeitedBy: [],
            result: { home: 0, away: 0 },
          },
        }),
        'away'
      )
    ).toBeUndefined();
  });

  it('reads a result the Verband has not confirmed yet, as its points show', () => {
    expect(
      outcomeOf(
        game({
          status: {
            kind: 'played',
            result: { home: 78, away: 47 },
            confirmed: false,
          },
        }),
        'home'
      )
    ).toBe('win');
  });

  it('gives a forfeit to the side that did not forfeit', () => {
    const forfeit = game({
      status: { kind: 'forfeited', forfeitedBy: ['away'] },
    });

    expect(outcomeOf(forfeit, 'home')).toBe('win');
    expect(outcomeOf(forfeit, 'away')).toBe('loss');
  });

  it('counts a forfeit of both sides as a loss for each', () => {
    const both = game({
      status: { kind: 'forfeited', forfeitedBy: ['home', 'away'] },
    });

    expect(outcomeOf(both, 'home')).toBe('loss');
    expect(outcomeOf(both, 'away')).toBe('loss');
  });

  it('reads a forfeit naming no side by its points, where it has any', () => {
    expect(
      outcomeOf(
        game({
          status: {
            kind: 'forfeited',
            forfeitedBy: [],
            result: { home: 0, away: 20 },
          },
        }),
        'away'
      )
    ).toBe('win');
    expect(
      outcomeOf(
        game({ status: { kind: 'forfeited', forfeitedBy: [] } }),
        'home'
      )
    ).toBeUndefined();
  });

  it.each([{ kind: 'scheduled' }, { kind: 'cancelled' }] as const)(
    'has none while $art',
    (status) => {
      expect(outcomeOf(game({ status }), 'home')).toBeUndefined();
    }
  );
});
