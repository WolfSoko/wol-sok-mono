import type { League } from './league';
import type { Game } from './game';
import type { Team } from './team';
import {
  leagueOf,
  leaguesCurrentFirst,
  nextGame,
  seasonOver,
  lastPlayed,
  keepsGameReports,
  type TeamSeason,
} from './team-season';

const OUR_TEAM: Team = { id: 313036, name: 'MTV Wasbüttel', clubId: 1837 };

function league(id: number, name: string): League {
  return {
    id,
    name,
    association: { id: 7, name: 'Niedersachsen' },
    ageGroup: 'U12',
    gender: 'mixed',
    division: 'Kreisliga',
  };
}

const FRIENDLIES = league(54689, 'Testspiele Braunschweig u12');
const FIRST_ROUND = league(54862, 'Regionsvorrunde Nord');
const MAIN_ROUND = league(54900, 'Regionsliga');

function game(
  id: number,
  leagueId: number,
  date: string,
  status: Game['status'] = { kind: 'scheduled' }
): Game {
  return {
    id,
    leagueId,
    date,
    matchday: 1,
    home: { kind: 'team', team: OUR_TEAM },
    away: { kind: 'open', label: 'Gegner' },
    status,
  };
}

/** A Saison with `games`, in date order as the port gives them. */
function season(...games: Game[]): TeamSeason {
  const leagues = [FRIENDLIES, FIRST_ROUND, MAIN_ROUND].filter((l) =>
    games.some((s) => s.leagueId === l.id)
  );
  return {
    team: OUR_TEAM,
    club: { id: 1837, name: 'MTV Wasbüttel' },
    leagues,
    games,
  };
}

function names(leagues: readonly League[]): readonly string[] {
  return leagues.map((l) => l.name);
}

describe('leaguesCurrentFirst', () => {
  it('has no Liga for a Team without Spiele', () => {
    expect(leaguesCurrentFirst(season(), '2026-11-08')).toEqual([]);
  });

  it('lists the one Liga a Team plays in', () => {
    expect(
      names(
        leaguesCurrentFirst(
          season(game(1, FIRST_ROUND.id, '2026-09-12')),
          '2026-11-08'
        )
      )
    ).toEqual([FIRST_ROUND.name]);
  });

  it('puts the Liga of the next Spiel first: a Hauptrunde after its Vorrunde', () => {
    const leagues = leaguesCurrentFirst(
      season(
        game(1, FIRST_ROUND.id, '2026-09-12'),
        game(2, FIRST_ROUND.id, '2026-11-01'),
        game(3, MAIN_ROUND.id, '2026-11-21')
      ),
      '2026-11-08'
    );

    expect(names(leagues)).toEqual([MAIN_ROUND.name, FIRST_ROUND.name]);
  });

  it('keeps a Vorrunde first while it still has a Spiel to come', () => {
    const leagues = leaguesCurrentFirst(
      season(
        game(1, FIRST_ROUND.id, '2026-09-12'),
        game(2, FIRST_ROUND.id, '2026-11-15'),
        game(3, MAIN_ROUND.id, '2027-01-16')
      ),
      '2026-11-08'
    );

    expect(names(leagues)).toEqual([FIRST_ROUND.name, MAIN_ROUND.name]);
  });

  it('counts a Spiel of today as the next one', () => {
    const leagues = leaguesCurrentFirst(
      season(
        game(1, FIRST_ROUND.id, '2026-11-01'),
        game(2, MAIN_ROUND.id, '2026-11-08')
      ),
      '2026-11-08'
    );

    expect(names(leagues)[0]).toBe(MAIN_ROUND.name);
  });

  it('puts the Liga of the last Spiel first once the Saison is over', () => {
    const leagues = leaguesCurrentFirst(
      season(
        game(1, FRIENDLIES.id, '2026-08-29'),
        game(2, FIRST_ROUND.id, '2026-09-12'),
        game(3, FIRST_ROUND.id, '2026-11-08')
      ),
      '2027-06-01'
    );

    expect(names(leagues)).toEqual([FIRST_ROUND.name, FRIENDLIES.name]);
  });

  it('lists the other Ligen by their last Spiel, newest first', () => {
    const leagues = leaguesCurrentFirst(
      season(
        game(1, FIRST_ROUND.id, '2026-09-12'),
        game(2, FRIENDLIES.id, '2026-10-03'),
        game(3, FIRST_ROUND.id, '2026-10-10'),
        game(4, MAIN_ROUND.id, '2026-11-21')
      ),
      '2026-11-08'
    );

    expect(names(leagues)).toEqual([
      MAIN_ROUND.name,
      FIRST_ROUND.name,
      FRIENDLIES.name,
    ]);
  });
  it('passes over a cancelled Spiel when looking for the next one', () => {
    const leagues = leaguesCurrentFirst(
      season(
        game(1, FIRST_ROUND.id, '2026-11-01'),
        game(2, MAIN_ROUND.id, '2026-11-10', { kind: 'cancelled' }),
        game(3, FIRST_ROUND.id, '2026-11-15')
      ),
      '2026-11-08'
    );

    expect(names(leagues)[0]).toBe(FIRST_ROUND.name);
  });

  it('passes over a cancelled last Spiel once the Saison is over', () => {
    const leagues = leaguesCurrentFirst(
      season(
        game(1, FIRST_ROUND.id, '2026-11-01'),
        game(2, FRIENDLIES.id, '2026-11-20', { kind: 'cancelled' })
      ),
      '2027-06-01'
    );

    expect(names(leagues)[0]).toBe(FIRST_ROUND.name);
  });

  it('counts a forfeited Spiel, whose result counts in its Liga', () => {
    const leagues = leaguesCurrentFirst(
      season(
        game(1, FIRST_ROUND.id, '2026-11-01'),
        game(2, MAIN_ROUND.id, '2026-11-10', {
          kind: 'forfeited',
          forfeitedBy: ['away'],
        }),
        game(3, FIRST_ROUND.id, '2026-11-15')
      ),
      '2026-11-08'
    );

    expect(names(leagues)[0]).toBe(MAIN_ROUND.name);
  });

  it("keeps today's Liga first on match day, once the Spiel is played", () => {
    const leagues = leaguesCurrentFirst(
      season(
        game(1, FIRST_ROUND.id, '2026-11-08', {
          kind: 'played',
          result: { home: 58, away: 67 },
          confirmed: false,
        }),
        game(2, MAIN_ROUND.id, '2026-11-21')
      ),
      '2026-11-08'
    );

    expect(names(leagues)[0]).toBe(FIRST_ROUND.name);
  });

  it('still names a Liga whose Spiele are all cancelled', () => {
    const leagues = leaguesCurrentFirst(
      season(game(1, FIRST_ROUND.id, '2026-11-15', { kind: 'cancelled' })),
      '2026-11-08'
    );

    expect(names(leagues)).toEqual([FIRST_ROUND.name]);
  });
});

describe('nextGame', () => {
  it("is the first Spiel from today on, today's included", () => {
    const today = game(2, FIRST_ROUND.id, '2026-11-08');

    expect(
      nextGame(
        season(game(1, FIRST_ROUND.id, '2026-11-01'), today),
        '2026-11-08'
      )
    ).toBe(today);
  });

  it('passes over a cancelled Spiel and a forfeited one, neither played', () => {
    const scheduled = game(4, FIRST_ROUND.id, '2026-11-21');

    expect(
      nextGame(
        season(
          game(2, FIRST_ROUND.id, '2026-11-10', { kind: 'cancelled' }),
          game(3, FIRST_ROUND.id, '2026-11-15', {
            kind: 'forfeited',
            forfeitedBy: [],
          }),
          game(5, FIRST_ROUND.id, '2026-11-16', {
            kind: 'forfeited',
            forfeitedBy: ['away'],
            result: { home: 20, away: 0 },
          }),
          scheduled
        ),
        '2026-11-08'
      )
    ).toBe(scheduled);
  });

  it("passes over today's Spiel once it has its result", () => {
    const tomorrow = game(3, FIRST_ROUND.id, '2026-11-09');

    expect(
      nextGame(
        season(
          game(2, FIRST_ROUND.id, '2026-11-08', {
            kind: 'played',
            result: { home: 58, away: 67 },
            confirmed: false,
          }),
          tomorrow
        ),
        '2026-11-08'
      )
    ).toBe(tomorrow);
  });

  it('is none once the Saison is over', () => {
    expect(
      nextGame(season(game(1, FIRST_ROUND.id, '2026-11-01')), '2026-11-08')
    ).toBeUndefined();
  });
});

describe('seasonOver', () => {
  const PLAYED: Game['status'] = {
    kind: 'played',
    result: { home: 78, away: 47 },
    confirmed: true,
  };

  it('holds once the last Spiel is more than two weeks past, none to come', () => {
    expect(
      seasonOver(
        season(
          game(1, FIRST_ROUND.id, '2026-10-03', PLAYED),
          game(2, FIRST_ROUND.id, '2026-10-24', PLAYED)
        ),
        '2026-11-08'
      )
    ).toBe(true);
  });

  it('holds from the fifteenth day after the last Spiel on', () => {
    const over = season(game(1, FIRST_ROUND.id, '2026-10-24', PLAYED));

    expect(seasonOver(over, '2026-11-08')).toBe(true);
  });

  it('does not hold exactly two weeks after the last Spiel', () => {
    const over = season(game(1, FIRST_ROUND.id, '2026-10-25', PLAYED));

    expect(seasonOver(over, '2026-11-08')).toBe(false);
  });

  it('counts calendar days across the change to winter time', () => {
    // 2026-10-25 has 25 hours in Germany
    const over = season(game(1, FIRST_ROUND.id, '2026-10-20', PLAYED));

    expect(seasonOver(over, '2026-11-03')).toBe(false);
    expect(seasonOver(over, '2026-11-04')).toBe(true);
  });

  it('does not hold while a postponed Spiel is still to come', () => {
    const moved = season(
      game(1, FIRST_ROUND.id, '2026-09-26', PLAYED),
      // moved from October to its new day
      game(2, FIRST_ROUND.id, '2026-12-05')
    );

    expect(seasonOver(moved, '2026-11-08')).toBe(false);
  });

  it('counts a past Spiel still without its result as the last one', () => {
    const ongoing = season(
      game(1, FIRST_ROUND.id, '2026-09-26', PLAYED),
      game(2, FIRST_ROUND.id, '2026-10-31')
    );

    expect(seasonOver(ongoing, '2026-11-08')).toBe(false);
  });

  it('does not hold for a Team without Spiele, whose Saison may not have begun', () => {
    expect(seasonOver(season(), '2026-11-08')).toBe(false);
  });
});

describe('leagueOf', () => {
  it('finds a Liga of the Saison by its id', () => {
    const twoLeagues = season(
      game(1, FRIENDLIES.id, '2026-08-29'),
      game(2, FIRST_ROUND.id, '2026-09-12')
    );

    expect(leagueOf(twoLeagues, FIRST_ROUND.id)).toBe(FIRST_ROUND);
    expect(leagueOf(twoLeagues, MAIN_ROUND.id)).toBeUndefined();
  });
});

describe('lastPlayed', () => {
  const PLAYED: Game['status'] = {
    kind: 'played',
    result: { home: 78, away: 47 },
    confirmed: false,
  };
  const TODAY = '2026-11-08';

  it("lists the Spiele played up to today, today's too, newest first", () => {
    const played = lastPlayed(
      season(
        game(1, FIRST_ROUND.id, '2026-10-03', PLAYED),
        game(2, FIRST_ROUND.id, '2026-10-17', PLAYED),
        game(3, FIRST_ROUND.id, '2026-11-08', PLAYED),
        game(4, FIRST_ROUND.id, '2026-11-21')
      ),
      TODAY,
      5
    );

    expect(played.map(({ id }) => id)).toEqual([3, 2, 1]);
  });

  it('passes over Spiele cancelled, forfeited or without a result', () => {
    const played = lastPlayed(
      season(
        game(1, FIRST_ROUND.id, '2026-10-03', PLAYED),
        game(2, FIRST_ROUND.id, '2026-10-10', { kind: 'cancelled' }),
        game(3, FIRST_ROUND.id, '2026-10-17', {
          kind: 'forfeited',
          forfeitedBy: ['away'],
        }),
        game(4, FIRST_ROUND.id, '2026-10-24')
      ),
      TODAY,
      5
    );

    expect(played.map(({ id }) => id)).toEqual([1]);
  });

  it('passes over a result the DBB lists ahead of its day', () => {
    const played = lastPlayed(
      season(game(1, FIRST_ROUND.id, '2026-11-21', PLAYED)),
      TODAY,
      5
    );

    expect(played).toEqual([]);
  });

  it('lists at most as many as asked, the newest', () => {
    const played = lastPlayed(
      season(
        game(1, FIRST_ROUND.id, '2026-10-03', PLAYED),
        game(2, FIRST_ROUND.id, '2026-10-10', PLAYED),
        game(3, FIRST_ROUND.id, '2026-10-17', PLAYED)
      ),
      TODAY,
      2
    );

    expect(played.map(({ id }) => id)).toEqual([3, 2]);
  });
});

describe('keepsGameReports', () => {
  it('is false for a Spiel of a Liga the DBB keeps no Spielberichte for', () => {
    const withoutReports: League = { ...MAIN_ROUND, withoutGameReports: true };
    const spiel = game(1, MAIN_ROUND.id, '2026-10-03');
    const saison: TeamSeason = {
      ...season(spiel),
      leagues: [withoutReports],
    };

    expect(keepsGameReports(saison, spiel)).toBe(false);
  });

  it('is true for a Spiel of a Liga with Spielberichte', () => {
    const spiel = game(1, FIRST_ROUND.id, '2026-10-03');

    expect(keepsGameReports(season(spiel), spiel)).toBe(true);
  });

  it('is true for a Spiel of a Liga the Saison does not list', () => {
    const spiel = game(1, 99999, '2026-10-03');

    expect(keepsGameReports(season(spiel), spiel)).toBe(true);
  });
});
