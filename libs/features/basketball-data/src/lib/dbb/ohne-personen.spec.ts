import { readEnvelope } from './envelope';
import tabelle from './fixtures/table-54862.json';
import teamSpiele from './fixtures/team-313036-matches.json';
import geplant from './fixtures/matchinfo-2843814.json';
import gespielt from './fixtures/matchinfo-2911141.json';
import ohneViertel from './fixtures/matchinfo-2861436.json';
import { mapSpielDetails } from './map-spiel-details';
import { mapTabelle } from './map-tabelle';
import { mapTeamSpiele } from './map-team-spiele';
import { dbbOhnePersonen } from './ohne-personen';

/** Whether `body` names a person anywhere (vorname, nachname, person data). */
function nenntPersonen(body: unknown): boolean {
  return /"(vorname|nachname|person|personData)"/.test(JSON.stringify(body));
}

describe('dbbOhnePersonen', () => {
  it.each([
    ['a played Spiel with its top performers and referees', gespielt],
    ['a Spiel without quarters', ohneViertel],
    ['a planned Spiel', geplant],
  ])("drops every person from a Spiel's match info: %s", (_fall, body) => {
    // the recorded answers do name persons: players and referees
    expect(nenntPersonen(body)).toBe(true);

    expect(nenntPersonen(dbbOhnePersonen(body))).toBe(false);
  });

  it.each([gespielt, ohneViertel, geplant])(
    'keeps all a Spiel is read from',
    (body) => {
      expect(mapSpielDetails(readEnvelope(dbbOhnePersonen(body)))).toEqual(
        mapSpielDetails(readEnvelope(body))
      );
    }
  );

  it("keeps a Team's Spiele and a Tabelle as they are", () => {
    expect(mapTeamSpiele(readEnvelope(dbbOhnePersonen(teamSpiele)))).toEqual(
      mapTeamSpiele(readEnvelope(teamSpiele))
    );
    expect(mapTabelle(readEnvelope(dbbOhnePersonen(tabelle)))).toEqual(
      mapTabelle(readEnvelope(tabelle))
    );
  });

  it('changes nothing it is given', () => {
    const vorher = JSON.stringify(gespielt);

    dbbOhnePersonen(gespielt);

    expect(JSON.stringify(gespielt)).toBe(vorher);
  });
});
