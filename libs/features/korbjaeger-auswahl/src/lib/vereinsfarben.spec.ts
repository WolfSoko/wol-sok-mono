import { KeineFarbeError, vereinsfarbenAus } from './vereinsfarben';

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
