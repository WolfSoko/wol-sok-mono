import type {
  Standings,
  StandingsRow,
} from '@wolsok/feat-shared-basketball-data';
import { standingsRows } from './standings-rows';

function row(
  rank: number,
  id: number,
  name: string,
  pointsFor: number,
  pointsAgainst: number
): StandingsRow {
  return {
    rank,
    participant: { kind: 'team', team: { id, name, clubId: id } },
    games: 5,
    wins: 5 - rank,
    losses: rank,
    points: 2 * (5 - rank),
    pointsFor,
    pointsAgainst,
    pointDifference: pointsFor - pointsAgainst,
  };
}

const STANDINGS: Standings = {
  league: {
    id: 54862,
    name: 'Regionsvorrunde Nord Braunschweig mu12',
    association: { id: 7, name: 'Niedersachsen' },
    ageGroup: 'U12',
    gender: 'mixed',
    division: 'Regionsliga',
  },
  rows: [
    row(1, 313040, 'TV Jahn Wolfsburg', 510, 191),
    row(2, 313036, 'MTV Wasbüttel', 470, 470),
    row(3, 322695, 'SV Groß Schwülper', 102, 575),
  ],
};

describe('standingsRows', () => {
  it('shows each line with its points for and against and the difference', () => {
    expect(standingsRows(STANDINGS, 313036)[0]).toEqual({
      rank: 1,
      team: 'TV Jahn Wolfsburg',
      games: 5,
      wins: 4,
      losses: 1,
      points: '510:191',
      difference: '+319',
      own: false,
    });
  });

  it('signs a negative difference with a minus and leaves an even one bare', () => {
    expect(
      standingsRows(STANDINGS, 313036).map(({ difference }) => difference)
    ).toEqual(['+319', '0', '−473']);
  });

  it("marks the Team's own line, and only that one", () => {
    expect(standingsRows(STANDINGS, 313036).map(({ own }) => own)).toEqual([
      false,
      true,
      false,
    ]);
  });

  it('names a slot of a Hauptrunde, which is never the Team', () => {
    const slot: StandingsRow = {
      ...row(1, 0, '', 0, 0),
      participant: { kind: 'open', label: 'Nord 1. Platz' },
    };

    expect(
      standingsRows({ ...STANDINGS, rows: [slot] }, 313036)[0]
    ).toMatchObject({ team: 'Nord 1. Platz', own: false, difference: '0' });
  });

  it('marks no line of a Tabelle without the Team', () => {
    expect(standingsRows(STANDINGS, 1).some(({ own }) => own)).toBe(false);
  });
});
