import type { Game } from './game';
import type { NamedPlayer, Roster, GameReport } from './game-report';
import { rosterOfTeam, childrenInRoster } from './children-in-roster';
import type { Team } from './team';

const OUR_TEAM: Team = { id: 313036, name: 'MTV Wasbüttel', clubId: 1837 };
const OPPONENT: Team = { id: 201500, name: 'MTV Gifhorn', clubId: 1500 };

function named(personId: number, firstName: string): NamedPlayer {
  return { kind: 'named', personId, firstName, lastName: 'Ahornwiese' };
}

function roster(...entries: Roster['entries']): Roster {
  return { playerStatsRecorded: false, entries };
}

const ALVO = named(7, 'Alvo');
const BRINA = named(8, 'Brina');
const CATU = named(9, 'Catu');

function game(home: Team, away: Team): Game {
  return {
    id: 1,
    leagueId: 54862,
    matchday: 1,
    date: '2026-11-08',
    home: { kind: 'team', team: home },
    away: { kind: 'team', team: away },
    status: { kind: 'scheduled' },
  };
}

const REPORT: GameReport = {
  gameId: 1,
  home: roster(ALVO),
  away: roster(BRINA),
};

describe('childrenInRoster', () => {
  it('finds the named players among the persons, in the Kader order', () => {
    expect(childrenInRoster(roster(CATU, ALVO, BRINA), [7, 9])).toEqual([
      CATU,
      ALVO,
    ]);
  });

  it('never finds an Anonymer Spieler', () => {
    expect(childrenInRoster(roster({ kind: 'anonymous' }), [7])).toEqual([]);
  });

  it('finds nobody for no persons', () => {
    expect(childrenInRoster(roster(ALVO), [])).toEqual([]);
  });
});

describe('rosterOfTeam', () => {
  it("is the Kader of the Team's side, at home or away", () => {
    expect(rosterOfTeam(REPORT, game(OUR_TEAM, OPPONENT), 313036)).toBe(
      REPORT.home
    );
    expect(rosterOfTeam(REPORT, game(OPPONENT, OUR_TEAM), 313036)).toBe(
      REPORT.away
    );
  });

  it('is none for a Team on neither side', () => {
    expect(
      rosterOfTeam(REPORT, game(OPPONENT, OPPONENT), 313036)
    ).toBeUndefined();
  });
});
