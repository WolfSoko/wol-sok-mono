import { caughtError } from '../../testing/caught-error';
import { readEnvelope } from './envelope';
import teamMatches from './fixtures/team-313036-matches.json';
import { mapTeamSpiele } from './map-team-spiele';

interface TeamMatches {
  readonly team: object;
  readonly matches: readonly object[];
}

const DATA = readEnvelope(teamMatches) as TeamMatches;
const FRIENDLY = 54689;
const VORRUNDE = 54862;

describe('mapTeamSpiele', () => {
  const saison = mapTeamSpiele(DATA);

  it('reads the Team by its permanent id, with its Verein', () => {
    expect(saison.team).toEqual({
      id: 313036,
      name: 'MTV Wasbüttel',
      vereinId: 1837,
    });
    expect(saison.verein).toEqual({ id: 1837, name: 'MTV Wasbüttel' });
  });

  it('lists the Spiele of both Ligen in one list, by date', () => {
    expect(saison.spiele.map((spiel) => [spiel.ligaId, spiel.datum])).toEqual([
      [FRIENDLY, '2026-08-29'],
      [VORRUNDE, '2026-09-12'],
      [VORRUNDE, '2026-09-20'],
      [VORRUNDE, '2026-09-25'],
      [VORRUNDE, '2026-10-03'],
      [VORRUNDE, '2026-11-08'],
    ]);
  });

  it('names the Ligen in the order the Team first plays them', () => {
    expect(saison.ligen.map((liga) => [liga.id, liga.name])).toEqual([
      [FRIENDLY, 'Testspiele Braunschweig u12'],
      [VORRUNDE, 'Regionsvorrunde Nord Braunschweig mu12'],
    ]);
  });

  it('sorts and merges however the DBB orders the Ligen', () => {
    const reversed = { ...DATA, matches: [...DATA.matches].reverse() };

    expect(mapTeamSpiele(reversed)).toEqual(saison);
  });

  it('lists a Spiel the DBB sends twice once', () => {
    const twice = { ...DATA, matches: [...DATA.matches, DATA.matches[0]] };

    expect(mapTeamSpiele(twice).spiele).toHaveLength(6);
  });

  it('sorts Spiele of one day by tip-off', () => {
    const [first, second] = DATA.matches;
    const sameDay = {
      ...DATA,
      matches: [
        { ...first, kickoffDate: '2026-12-05', kickoffTime: '15:00' },
        { ...second, kickoffDate: '2026-12-05', kickoffTime: '10:00' },
      ],
    };

    expect(mapTeamSpiele(sameDay).spiele.map((spiel) => spiel.uhrzeit)).toEqual(
      ['10:00', '15:00']
    );
  });

  it('refuses a response without its Team', () => {
    expect(
      caughtError(() => mapTeamSpiele({ ...DATA, team: null })).message
    ).toBe('teamMatches.team: expected an object, got null');
  });
});
