import {
  farbenAusText,
  farbenText,
  KeineFarbeError,
  vereinsfarbenAus,
} from './vereinsfarben';

describe('vereinsfarbenAus', () => {
  it('stores colours in lower case, a second one only where given', () => {
    expect(vereinsfarbenAus('#C8102E')).toEqual({ primaer: '#c8102e' });
    expect(vereinsfarbenAus('#c8102e', '#1D4ED8')).toEqual({
      primaer: '#c8102e',
      zweite: '#1d4ed8',
    });
  });

  it.each(['red', '#c81', '#c8102e00', 'c8102e', ' #c8102e', '#gggggg'])(
    'refuses %j',
    (wert) => {
      expect(() => vereinsfarbenAus(wert)).toThrow(KeineFarbeError);
      expect(() => vereinsfarbenAus('#c8102e', wert)).toThrow(KeineFarbeError);
    }
  );
});

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
