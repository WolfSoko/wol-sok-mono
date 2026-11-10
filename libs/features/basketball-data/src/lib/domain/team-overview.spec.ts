import type { Game } from './game';
import type { Team } from './team';
import type { TeamSeason } from './team-season';
import { combinedOverview, byNextGame, teamOverview } from './team-overview';

const OUR_TEAM: Team = { id: 313036, name: 'MTV Wasbüttel', clubId: 1837 };

const PLAYED: Game['status'] = {
  kind: 'played',
  result: { home: 78, away: 47 },
  confirmed: true,
};

function game(
  id: number,
  date: string,
  status: Game['status'] = { kind: 'scheduled' },
  time: string | undefined = '10:00'
): Game {
  return {
    id,
    leagueId: 54862,
    date,
    time,
    matchday: 1,
    home: { kind: 'team', team: OUR_TEAM },
    away: { kind: 'open', label: 'Gegner' },
    status,
  };
}

/** A Saison with `games`, in date order as the port gives them. */
function season(...games: Game[]): TeamSeason {
  return seasonOf(OUR_TEAM, ...games);
}

function seasonOf(team: Team, ...games: Game[]): TeamSeason {
  return {
    team,
    club: { id: 1837, name: 'MTV Wasbüttel' },
    leagues: [],
    games,
  };
}

function ids(games: readonly Game[]): readonly number[] {
  return games.map(({ id }) => id);
}

const TODAY = '2026-11-08';

describe('teamOverview', () => {
  it('has neither a next Spiel nor a result for a Team without Spiele', () => {
    expect(teamOverview(season(), TODAY)).toEqual({ cancellations: [] });
  });

  it('has the next Spiel and the last result around today', () => {
    const overview = teamOverview(
      season(
        game(1, '2026-10-03', PLAYED),
        game(2, '2026-10-17', PLAYED),
        game(3, '2026-11-21'),
        game(4, '2026-12-05')
      ),
      TODAY
    );

    expect(overview.next?.id).toBe(3);
    expect(overview.last?.id).toBe(2);
  });

  it('has only the last result once no Spiel is left', () => {
    const overview = teamOverview(season(game(1, '2026-10-03', PLAYED)), TODAY);

    expect(overview.next).toBeUndefined();
    expect(overview.last?.id).toBe(1);
  });

  it('passes over a past Spiel still waiting for its result', () => {
    const overview = teamOverview(
      season(game(1, '2026-10-03', PLAYED), game(2, '2026-10-17')),
      TODAY
    );

    expect(overview.last?.id).toBe(1);
  });

  it("counts today's Spiel as the last result once it has one, not as the next", () => {
    const overview = teamOverview(
      season(
        game(1, '2026-10-03', PLAYED),
        game(2, TODAY, PLAYED),
        game(3, '2026-11-21')
      ),
      TODAY
    );

    expect(overview.last?.id).toBe(2);
    expect(overview.next?.id).toBe(3);
  });

  it('counts a forfeited Spiel as a result, and one to come as falling through', () => {
    const forfeited: Game['status'] = {
      kind: 'forfeited',
      forfeitedBy: ['away'],
    };

    const overview = teamOverview(
      season(
        game(1, '2026-10-03', forfeited),
        game(2, '2026-11-14', forfeited),
        game(3, '2026-11-21')
      ),
      TODAY
    );

    expect(overview.last?.id).toBe(1);
    expect(overview.next?.id).toBe(3);
    expect(ids(overview.cancellations)).toEqual([2]);
  });

  it("shows today's forfeit as the last result only", () => {
    const forfeited: Game['status'] = {
      kind: 'forfeited',
      forfeitedBy: ['away'],
    };

    const overview = teamOverview(
      season(game(1, TODAY, forfeited), game(2, '2026-11-21')),
      TODAY
    );

    expect(overview.last?.id).toBe(1);
    expect(overview.cancellations).toEqual([]);
  });

  it('lists the cancelled Spiele before the next one, which it passes over', () => {
    const cancelled: Game['status'] = { kind: 'cancelled' };

    const overview = teamOverview(
      season(
        game(1, '2026-10-03', cancelled),
        game(2, '2026-11-14', cancelled),
        game(3, '2026-11-21'),
        game(4, '2026-12-05', cancelled)
      ),
      TODAY
    );

    expect(overview.next?.id).toBe(3);
    expect(ids(overview.cancellations)).toEqual([2]);
  });

  it('lists every Spiel to come that falls through where none takes place', () => {
    const overview = teamOverview(
      season(
        game(1, '2026-10-03', PLAYED),
        game(2, '2026-11-14', { kind: 'cancelled' }),
        game(3, '2026-11-21', { kind: 'forfeited', forfeitedBy: [] })
      ),
      TODAY
    );

    expect(overview.next).toBeUndefined();
    expect(ids(overview.cancellations)).toEqual([2, 3]);
    expect(overview.last?.id).toBe(1);
  });
});

describe('byNextGame', () => {
  interface Entry {
    readonly name: string;
    readonly next?: Game;
  }

  function names(entries: readonly Entry[]): readonly string[] {
    return entries.map(({ name }) => name);
  }

  function sorted(...entries: Entry[]): readonly string[] {
    return names(byNextGame(entries, ({ next }) => next));
  }

  it('puts the Team that plays first first', () => {
    expect(
      sorted(
        { name: 'später', next: game(1, '2026-11-21') },
        { name: 'bald', next: game(2, '2026-11-14') }
      )
    ).toEqual(['bald', 'später']);
  });

  it('orders a shared day by tip-off, a Spiel without one last', () => {
    expect(
      sorted(
        {
          name: 'ohne Uhrzeit',
          next: { ...game(1, '2026-11-14'), time: undefined },
        },
        {
          name: 'nachmittags',
          next: game(2, '2026-11-14', undefined, '15:00'),
        },
        {
          name: 'morgens',
          next: game(3, '2026-11-14', undefined, '09:30'),
        }
      )
    ).toEqual(['morgens', 'nachmittags', 'ohne Uhrzeit']);
  });

  it('puts Teams without a next Spiel last, in the order given', () => {
    expect(
      sorted(
        { name: 'fertig A' },
        { name: 'spielt', next: game(1, '2026-11-21') },
        { name: 'fertig B' }
      )
    ).toEqual(['spielt', 'fertig A', 'fertig B']);
  });

  it('keeps the order given where the next Spiele start together', () => {
    expect(
      sorted(
        { name: 'erst gefolgt', next: game(1, '2026-11-21') },
        { name: 'dann gefolgt', next: game(2, '2026-11-21') }
      )
    ).toEqual(['erst gefolgt', 'dann gefolgt']);
  });

  it('leaves the list it was given alone', () => {
    const entries: Entry[] = [
      { name: 'später', next: game(1, '2026-11-21') },
      { name: 'bald', next: game(2, '2026-11-14') },
    ];

    byNextGame(entries, ({ next }) => next);

    expect(names(entries)).toEqual(['später', 'bald']);
  });
});

describe('combinedOverview', () => {
  const U14: Team = { id: 313040, name: 'MTV Wasbüttel U14', clubId: 1837 };

  function overview(...seasons: TeamSeason[]) {
    const combined = combinedOverview(
      seasons.map((s) => ({ season: s, overview: teamOverview(s, TODAY) }))
    );
    return {
      next: combined.next && [
        combined.next.season.team.id,
        combined.next.game.id,
      ],
      cancellations: combined.cancellations.map((entry) => entry.game.id),
      laterCancellations: combined.laterCancellations.map(
        (entry) => entry.game.id
      ),
      last: combined.last && [
        combined.last.season.team.id,
        combined.last.game.id,
      ],
    };
  }

  it('has nothing for no Saison', () => {
    expect(overview()).toEqual({ cancellations: [], laterCancellations: [] });
  });

  it("takes the first next Spiel and the latest result of all Teams', each with its Saison", () => {
    expect(
      overview(
        season(game(1, '2026-11-01', PLAYED), game(2, '2026-11-21')),
        seasonOf(
          U14,
          game(3, '2026-11-07', PLAYED),
          game(4, '2026-11-14', { kind: 'scheduled' }, '18:00')
        )
      )
    ).toEqual({
      next: [U14.id, 4],
      cancellations: [],
      laterCancellations: [],
      last: [U14.id, 3],
    });
  });

  it('orders by tip-off within a day, the first Saison winning a tie', () => {
    expect(
      overview(
        season(game(1, '2026-11-14', { kind: 'scheduled' }, '12:00')),
        seasonOf(U14, game(2, '2026-11-14', { kind: 'scheduled' }, '10:00'))
      ).next
    ).toEqual([U14.id, 2]);
    expect(
      overview(
        season(game(1, '2026-11-14')),
        seasonOf(U14, game(2, '2026-11-14'))
      ).next
    ).toEqual([OUR_TEAM.id, 1]);
  });

  it("lists each Team's Spiele falling through, as its own overview does, by tip-off", () => {
    expect(
      overview(
        season(
          game(1, '2026-11-15', { kind: 'cancelled' }),
          game(2, '2026-11-29')
        ),
        seasonOf(
          U14,
          game(3, '2026-11-08', { kind: 'cancelled' }),
          game(4, '2026-11-21')
        )
      ).cancellations
    ).toEqual([3, 1]);
  });

  it("keeps a Team's cancelled Spiel on the day of another Team's next one, without a tip-off", () => {
    const combined = overview(
      season(game(1, '2026-11-14', { kind: 'scheduled' }, '12:00')),
      seasonOf(
        U14,
        { ...game(2, '2026-11-14', { kind: 'cancelled' }), time: undefined },
        game(3, '2026-11-21')
      )
    );

    // without a tip-off, it comes after the timed Spiele of its day
    expect(combined.next).toEqual([OUR_TEAM.id, 1]);
    expect(combined.cancellations).toEqual([]);
    expect(combined.laterCancellations).toEqual([2]);
  });

  it("keeps a Team's cancelled Spiel after another Team's next one", () => {
    const combined = overview(
      season(game(1, '2026-11-14')),
      seasonOf(
        U14,
        game(2, '2026-11-21', { kind: 'cancelled' }),
        game(3, '2026-11-28')
      )
    );

    expect(combined.next).toEqual([OUR_TEAM.id, 1]);
    expect(combined.cancellations).toEqual([]);
    expect(combined.laterCancellations).toEqual([2]);
  });

  it('lists every Spiel falling through where none is next', () => {
    expect(
      overview(
        season(game(1, '2026-11-15', { kind: 'cancelled' })),
        seasonOf(U14, game(2, '2026-11-08', { kind: 'cancelled' }))
      ).cancellations
    ).toEqual([2, 1]);
  });
});
