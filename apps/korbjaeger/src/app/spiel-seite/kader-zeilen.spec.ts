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
