import type { Spiel } from './spiel';
import type { BenannterSpieler, Kader, Spielbericht } from './spielbericht';
import { kaderDesTeams, kinderImKader } from './kinder-im-kader';
import type { Team } from './team';

const UNSER_TEAM: Team = { id: 313036, name: 'MTV Wasbüttel', vereinId: 1837 };
const GEGNER: Team = { id: 201500, name: 'MTV Gifhorn', vereinId: 1500 };

function benannt(personId: number, vorname: string): BenannterSpieler {
  return { art: 'benannt', personId, vorname, nachname: 'Ahornwiese' };
}

function kader(...eintraege: Kader['eintraege']): Kader {
  return { spielerwerteErfasst: false, eintraege };
}

const ALVO = benannt(7, 'Alvo');
const BRINA = benannt(8, 'Brina');
const CATU = benannt(9, 'Catu');

function spiel(heim: Team, gast: Team): Spiel {
  return {
    id: 1,
    ligaId: 54862,
    spieltag: 1,
    datum: '2026-11-08',
    heim: { art: 'team', team: heim },
    gast: { art: 'team', team: gast },
    status: { art: 'geplant' },
  };
}

const BERICHT: Spielbericht = {
  spielId: 1,
  heim: kader(ALVO),
  gast: kader(BRINA),
};

describe('kinderImKader', () => {
  it('finds the named players among the persons, in the Kader order', () => {
    expect(kinderImKader(kader(CATU, ALVO, BRINA), [7, 9])).toEqual([
      CATU,
      ALVO,
    ]);
  });

  it('never finds an Anonymer Spieler', () => {
    expect(kinderImKader(kader({ art: 'anonym' }), [7])).toEqual([]);
  });

  it('finds nobody for no persons', () => {
    expect(kinderImKader(kader(ALVO), [])).toEqual([]);
  });
});

describe('kaderDesTeams', () => {
  it("is the Kader of the Team's side, at home or away", () => {
    expect(kaderDesTeams(BERICHT, spiel(UNSER_TEAM, GEGNER), 313036)).toBe(
      BERICHT.heim
    );
    expect(kaderDesTeams(BERICHT, spiel(GEGNER, UNSER_TEAM), 313036)).toBe(
      BERICHT.gast
    );
  });

  it('is none for a Team on neither side', () => {
    expect(
      kaderDesTeams(BERICHT, spiel(GEGNER, GEGNER), 313036)
    ).toBeUndefined();
  });
});
