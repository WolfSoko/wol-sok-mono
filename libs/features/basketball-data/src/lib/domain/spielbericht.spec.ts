import { feldkoerbe, istBenannt, type KaderEintrag } from './spielbericht';

describe('istBenannt', () => {
  it('tells a named player from an Anonymer Spieler', () => {
    const benannt: KaderEintrag = {
      art: 'benannt',
      personId: 7,
      vorname: 'Alvo',
      nachname: 'Ahornfeld',
    };
    const anonym: KaderEintrag = { art: 'anonym' };

    expect(istBenannt(benannt)).toBe(true);
    expect(istBenannt(anonym)).toBe(false);
  });
});

describe('feldkoerbe', () => {
  it('counts the field goals: twos and threes made, no free throws', () => {
    expect(
      feldkoerbe({
        punkte: 29,
        zweier: 9,
        dreier: 3,
        freiwuerfe: { getroffen: 2, versucht: 7 },
        fouls: 3,
      })
    ).toBe(12);
  });
});
