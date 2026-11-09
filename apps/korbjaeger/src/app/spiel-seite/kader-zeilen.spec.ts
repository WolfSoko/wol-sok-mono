import type { Kader, Spielerwerte } from '@wolsok/feat-shared-basketball-data';
import { kaderZeilen } from './kader-zeilen';

const WERTE: Spielerwerte = {
  punkte: 29,
  zweier: 9,
  dreier: 3,
  freiwuerfe: { getroffen: 2, versucht: 7 },
  fouls: 3,
};

describe('kaderZeilen', () => {
  it('names a player as the DBB shows them, with their shirt number', () => {
    const kader: Kader = {
      spielerwerteErfasst: false,
      eintraege: [
        {
          art: 'benannt',
          personId: 7,
          vorname: 'Orvin',
          nachname: 'Nesselbach',
          trikotnummer: '7',
        },
      ],
    };

    expect(kaderZeilen(kader)).toEqual([
      { nummer: '7', name: 'Orvin Nesselbach', anonym: false },
    ]);
  });

  it('shows an Anonymer Spieler as such, without number or person id', () => {
    const kader: Kader = {
      spielerwerteErfasst: true,
      eintraege: [{ art: 'anonym', spielerwerte: WERTE }],
    };

    expect(kaderZeilen(kader)).toEqual([
      {
        name: 'Anonymer Spieler',
        anonym: true,
        werte: { punkte: 29, feldkoerbe: 12, freiwuerfe: '2/7', fouls: 3 },
      },
    ]);
  });

  it('gives no Spielerwerte for a Kader without, never zeros', () => {
    const kader: Kader = {
      spielerwerteErfasst: false,
      eintraege: [{ art: 'anonym' }],
    };

    expect(kaderZeilen(kader)[0].werte).toBeUndefined();
  });
});

describe('kaderZeilen of a followed Team', () => {
  const kader: Kader = {
    spielerwerteErfasst: false,
    eintraege: [
      { art: 'benannt', personId: 7, vorname: 'Orvin', nachname: 'Nesselbach' },
      { art: 'benannt', personId: 8, vorname: 'Lumi', nachname: 'Ahornwiese' },
      { art: 'anonym' },
    ],
  };

  it('offers to mark each named player, never an Anonymer Spieler', () => {
    const zeilen = kaderZeilen(kader, []);

    expect(zeilen.map((zeile) => zeile.spieler)).toEqual([
      { art: 'benannt', personId: 7 },
      { art: 'benannt', personId: 8 },
      undefined,
    ]);
  });

  it('gives a marked Kind its mark, with its Spitzname', () => {
    const zeilen = kaderZeilen(kader, [
      { personId: 8, spitzname: 'Lu' },
      { personId: 99 },
    ]);

    expect(zeilen.map((zeile) => zeile.kind)).toEqual([
      undefined,
      { personId: 8, spitzname: 'Lu' },
      undefined,
    ]);
  });

  it("offers no mark in a Team's Kader nobody follows", () => {
    const zeilen = kaderZeilen(kader);

    expect(zeilen.every((zeile) => !zeile.spieler && !zeile.kind)).toBe(true);
  });
});
