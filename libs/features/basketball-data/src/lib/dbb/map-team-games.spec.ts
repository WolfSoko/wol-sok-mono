import { caughtError } from '../../testing/caught-error';
import { readEnvelope } from './envelope';
import bblTeamMatches from './fixtures/team-163073-matches.json';
import teamMatches from './fixtures/team-313036-matches.json';
import { mapTeamGames } from './map-team-games';

interface TeamMatches {
  readonly team: object;
  readonly matches: readonly object[];
}

const DATA = readEnvelope(teamMatches) as TeamMatches;
const FRIENDLY = 54689;
const FIRST_ROUND = 54862;

describe('mapTeamGames', () => {
  const season = mapTeamGames(DATA);

  it('reads the Team by its permanent id, with its Verein', () => {
    expect(season.team).toEqual({
      id: 313036,
      name: 'MTV Wasbüttel',
      clubId: 1837,
    });
    expect(season.club).toEqual({ id: 1837, name: 'MTV Wasbüttel' });
  });

  it('lists the Spiele of both Ligen in one list, by date', () => {
    expect(season.games.map((game) => [game.leagueId, game.date])).toEqual([
      [FRIENDLY, '2026-08-29'],
      [FIRST_ROUND, '2026-09-12'],
      [FIRST_ROUND, '2026-09-20'],
      [FIRST_ROUND, '2026-09-25'],
      [FIRST_ROUND, '2026-10-03'],
      [FIRST_ROUND, '2026-11-08'],
    ]);
  });

  it('names the Ligen in the order the Team first plays them', () => {
    expect(season.leagues.map((league) => [league.id, league.name])).toEqual([
      [FRIENDLY, 'Testspiele Braunschweig u12'],
      [FIRST_ROUND, 'Regionsvorrunde Nord Braunschweig mu12'],
    ]);
  });

  it('sorts and merges however the DBB orders the Ligen', () => {
    const reversed = { ...DATA, matches: [...DATA.matches].reverse() };

    expect(mapTeamGames(reversed)).toEqual(season);
  });

  it('lists a Spiel the DBB sends twice once', () => {
    const twice = { ...DATA, matches: [...DATA.matches, DATA.matches[0]] };

    expect(mapTeamGames(twice).games).toHaveLength(6);
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

    expect(mapTeamGames(sameDay).games.map((game) => game.time)).toEqual([
      '10:00',
      '15:00',
    ]);
  });

  describe('whether the DBB ever confirms a Liga’s results', () => {
    it('marks every Liga of a BBL Team, though its Spiele send no statisticType', () => {
      const bbl = mapTeamGames(readEnvelope(bblTeamMatches));

      expect(
        bbl.leagues.map((league) => [league.name, league.resultsNeverConfirmed])
      ).toEqual([
        ['1. Bundesliga (easyCredit BBL)', true],
        ['BBL-Pokal 1/8-Finale', true],
        ['BBL-Pokal 1/4-Finale', true],
      ]);
    });

    it('leaves it out for a Landesverband’s youth Ligen', () => {
      expect(
        season.leagues.map((league) => league.resultsNeverConfirmed)
      ).toEqual([undefined, undefined]);
    });
  });

  it("leaves out whether a Liga keeps Spielberichte, as the recorded Ligen don't say", () => {
    expect(season.leagues.map((league) => league.withoutGameReports)).toEqual([
      undefined,
      undefined,
    ]);
  });

  it('refuses a response without its Team', () => {
    expect(
      caughtError(() => mapTeamGames({ ...DATA, team: null })).message
    ).toBe('teamMatches.team: expected an object, got null');
  });
});
