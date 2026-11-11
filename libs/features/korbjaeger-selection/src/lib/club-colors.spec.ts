import { NotAColorError, clubColorsOf } from './club-colors';

describe('clubColorsOf', () => {
  it('stores colours in lower case, a second one only where given', () => {
    expect(clubColorsOf('#C8102E')).toEqual({ primary: '#c8102e' });
    expect(clubColorsOf('#c8102e', '#1D4ED8')).toEqual({
      primary: '#c8102e',
      secondary: '#1d4ed8',
    });
  });

  it.each(['red', '#c81', '#c8102e00', 'c8102e', ' #c8102e', '#gggggg'])(
    'refuses %j',
    (value) => {
      expect(() => clubColorsOf(value)).toThrow(NotAColorError);
      expect(() => clubColorsOf('#c8102e', value)).toThrow(NotAColorError);
    }
  );
});
