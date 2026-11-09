import { farbenAusText, farbenText, nachVerein } from './vereinsfarben-wahl';

describe('the colours as stored text', () => {
  it.each([{ primaer: '#c8102e' }, { primaer: '#c8102e', zweite: '#1d4ed8' }])(
    'reads %j back as written',
    (farben) => {
      expect(farbenAusText(farbenText(farben))).toEqual(farben);
    }
  );

  it.each([
    undefined,
    7,
    '',
    'rot',
    '#C8102E',
    ',#1d4ed8',
    '#c8102e,',
    '#c8102e,#1d4ed8,#007a3d',
    { primaer: '#c8102e' },
  ])('reads %j as no colours', (text) => {
    expect(farbenAusText(text)).toBeUndefined();
  });
});

describe('nachVerein', () => {
  it('orders by the Verein id, leaving the list as it was', () => {
    const liste = [
      { vereinId: 4343, primaer: '#1d4ed8' },
      { vereinId: 4242, primaer: '#c8102e' },
    ];

    expect(nachVerein(liste).map(({ vereinId }) => vereinId)).toEqual([
      4242, 4343,
    ]);
    expect(liste[0].vereinId).toBe(4343);
  });
});
