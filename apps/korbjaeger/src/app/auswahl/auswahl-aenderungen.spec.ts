import {
  abgebenAenderung,
  entfolgenAenderung,
  folgenAenderung,
  teamPlatz,
} from './auswahl-aenderungen';
import { LEERE_AUSWAHL, type AuswahlInhalt } from './auswahl-dokument';

const A = 313036;
const B = 201765;
const C = 201500;
const D = 201999;

const gelesen: AuswahlInhalt = {
  ...LEERE_AUSWAHL,
  teams: [A, B, C],
  teamsSeit: new Map([
    [A, 10],
    [B, 20],
    [C, 30],
  ]),
};

describe('teamPlatz', () => {
  it("is the Team's place among Meine Teams", () => {
    expect(teamPlatz(gelesen, B)).toEqual({ seit: 20 });
  });

  it('is none for a Team not followed, or one whose seit is not known yet', () => {
    expect(teamPlatz(gelesen, D)).toBeUndefined();
    expect(teamPlatz({ ...LEERE_AUSWAHL, teams: [D] }, D)).toBeUndefined();
  });
});

describe('folgenAenderung', () => {
  const ohneB = entfolgenAenderung(B)(gelesen);

  it('follows a Team at its place, before the first Team with a later seit', () => {
    const platz = teamPlatz(gelesen, B);

    const nachher = folgenAenderung(B, platz)(ohneB);

    expect(nachher.teams).toEqual([A, B, C]);
    expect(nachher.teamsSeit?.get(B)).toBe(20);
  });

  it('puts a Team at its place before Teams whose seit is not known yet', () => {
    const mitD = folgenAenderung(D)(ohneB);

    expect(folgenAenderung(B, { seit: 20 })(mitD).teams).toEqual([A, B, C, D]);
  });

  it('puts a Team before one with the same seit and a larger id, as the reader orders', () => {
    const gleich: AuswahlInhalt = {
      ...LEERE_AUSWAHL,
      teams: [B],
      teamsSeit: new Map([[B, 20]]),
    };

    expect(folgenAenderung(C, { seit: 20 })(gleich).teams).toEqual([C, B]);
    expect(folgenAenderung(A, { seit: 20 })(gleich).teams).toEqual([B, A]);
  });

  it('follows at the end without a place', () => {
    expect(folgenAenderung(B)(ohneB).teams).toEqual([A, C, B]);
  });

  it('changes nothing for a Team followed already', () => {
    expect(folgenAenderung(B, { seit: 1 })(gelesen)).toBe(gelesen);
  });
});

describe('entfolgenAenderung', () => {
  it("forgets the Team's seit, so a plain follow later takes a new one", () => {
    expect(entfolgenAenderung(B)(gelesen).teamsSeit?.has(B)).toBe(false);
  });
});

describe('abgebenAenderung', () => {
  it('keeps the places of the Teams that stay', () => {
    const nachher = abgebenAenderung({ ...LEERE_AUSWAHL, teams: [B] })(gelesen);

    expect(nachher.teamsSeit).toEqual(
      new Map([
        [A, 10],
        [C, 30],
      ])
    );
  });
});
