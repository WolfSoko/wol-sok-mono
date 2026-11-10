import { readEnvelope } from './envelope';
import standings from './fixtures/table-54862.json';
import teamGames from './fixtures/team-313036-matches.json';
import scheduled from './fixtures/matchinfo-2843814.json';
import played from './fixtures/matchinfo-2911141.json';
import withoutQuarters from './fixtures/matchinfo-2861436.json';
import { mapGameDetails } from './map-game-details';
import { mapStandings } from './map-standings';
import { mapTeamGames } from './map-team-games';
import { dbbWithoutPersons } from './without-persons';

/**
 * Whether `body` says anything of a person: a name, person data, a player
 * id, or a player's top performances (their values, by id).
 */
function namesPersons(body: unknown): boolean {
  return /"(vorname|nachname|person|personData|playerId|topPerformances)"/.test(
    JSON.stringify(body)
  );
}

describe('dbbWithoutPersons', () => {
  it.each([
    ['a played Spiel with its top performers and referees', played],
    ['a Spiel without quarters', withoutQuarters],
    ['a planned Spiel', scheduled],
  ])("drops every person from a Spiel's match info: %s", (_case, body) => {
    // the recorded answers do name persons: players and referees
    expect(namesPersons(body)).toBe(true);

    expect(namesPersons(dbbWithoutPersons(body))).toBe(false);
  });

  it.each([played, withoutQuarters, scheduled])(
    'keeps all a Spiel is read from',
    (body) => {
      expect(mapGameDetails(readEnvelope(dbbWithoutPersons(body)))).toEqual(
        mapGameDetails(readEnvelope(body))
      );
    }
  );

  it("keeps a Team's Spiele and a Tabelle as they are", () => {
    expect(mapTeamGames(readEnvelope(dbbWithoutPersons(teamGames)))).toEqual(
      mapTeamGames(readEnvelope(teamGames))
    );
    expect(mapStandings(readEnvelope(dbbWithoutPersons(standings)))).toEqual(
      mapStandings(readEnvelope(standings))
    );
  });

  it('changes nothing it is given', () => {
    const before = JSON.stringify(played);

    dbbWithoutPersons(played);

    expect(JSON.stringify(played)).toBe(before);
  });
});
