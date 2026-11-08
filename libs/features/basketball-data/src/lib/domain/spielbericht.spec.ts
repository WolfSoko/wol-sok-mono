import { istBenannt, type KaderEintrag } from './spielbericht';

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
