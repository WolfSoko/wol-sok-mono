import { caughtError } from '../../testing/caught-error';
import { readEnvelope } from './envelope';
import table from './fixtures/table-54308.json';
import friendlyTable from './fixtures/table-54689.json';
import mainRoundTable from './fixtures/table-54857.json';
import firstRoundTable from './fixtures/table-54862.json';
import { mapStandings } from './map-standings';

describe('mapStandings', () => {
  const standings = mapStandings(readEnvelope(table));

  it('reads the Liga with its Saison', () => {
    expect(standings.league.id).toBe(54308);
    expect(standings.league.season).toEqual({ id: 2026, name: '2026/2027' });
  });

  it('reads each line, the Team by its permanent id', () => {
    expect(standings.rows).toHaveLength(7);
    expect(standings.rows[0]).toEqual({
      rank: 1,
      participant: {
        kind: 'team',
        team: { id: 156618, name: 'Post SV Nürnberg', clubId: 1476 },
      },
      games: 4,
      wins: 4,
      losses: 0,
      points: 8,
      pointsFor: 411,
      pointsAgainst: 288,
      pointDifference: 123,
    });
    expect(standings.rows.map((row) => row.rank)).toEqual([
      1, 2, 3, 4, 5, 6, 7,
    ]);
  });

  it('reads every line of a Vorrunde, its Teams by the ids their Spiele name', () => {
    const firstRound = mapStandings(readEnvelope(firstRoundTable));

    expect(firstRound.league.name).toBe(
      'Regionsvorrunde Nord Braunschweig mu12'
    );
    expect(firstRound.rows[1]).toEqual({
      rank: 2,
      participant: {
        kind: 'team',
        team: { id: 313036, name: 'MTV Wasbüttel -RST-', clubId: 1837 },
      },
      games: 5,
      wins: 4,
      losses: 1,
      points: 8,
      pointsFor: 470,
      pointsAgainst: 204,
      pointDifference: 266,
    });
    expect(
      firstRound.rows.map(({ participant }) =>
        participant.kind === 'team' ? participant.team.id : undefined
      )
    ).toEqual([313040, 313036, 201500, 320898, 319164, 322695]);
  });

  it('reads the lines of a Hauptrunde whose Vorrunden are still open as slots', () => {
    const mainRound = mapStandings(readEnvelope(mainRoundTable));

    expect(mainRound.rows).toHaveLength(6);
    expect(mainRound.rows[2]).toEqual({
      rank: 3,
      participant: { kind: 'open', label: 'Nord 1. Platz' },
      games: 0,
      wins: 0,
      losses: 0,
      points: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      pointDifference: 0,
    });
  });

  it('reads a friendly Liga, which the DBB keeps no Tabelle for, as empty', () => {
    const friendlies = mapStandings(readEnvelope(friendlyTable));

    expect(friendlies.league.id).toBe(54689);
    expect(friendlies.rows).toEqual([]);
  });

  it('reads a Liga that keeps no Tabelle yet as empty', () => {
    const data = { ...(readEnvelope(table) as object), tabelle: null };

    expect(mapStandings(data).rows).toEqual([]);
  });

  it('refuses a line without its Team', () => {
    const data = readEnvelope(table) as { tabelle: { entries: object[] } };
    const broken = {
      ...data,
      tabelle: { entries: [{ ...data.tabelle.entries[0], team: null }] },
    };

    expect(caughtError(() => mapStandings(broken)).message).toBe(
      'table.tabelle.entries[0].team: expected an object, got null'
    );
  });
});
