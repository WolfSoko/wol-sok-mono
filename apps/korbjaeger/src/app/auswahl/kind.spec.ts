import {
  kindMit,
  SPITZNAME_LAENGE,
  spitznameAus,
  spitznameZeichen,
} from './kind';

describe('spitznameAus', () => {
  it('trims the Spitzname', () => {
    expect(spitznameAus('  Mimi ')).toBe('Mimi');
  });

  it.each([[''], ['   '], [undefined]])('takes %j for none', (eingabe) => {
    expect(spitznameAus(eingabe)).toBeUndefined();
  });

  it(`keeps at most ${SPITZNAME_LAENGE} characters, an emoji as one`, () => {
    const lang = `🏀👨‍👧${'a'.repeat(40)}`;

    expect(spitznameAus(lang)).toBe(`🏀👨‍👧${'a'.repeat(SPITZNAME_LAENGE - 2)}`);
  });
});

describe('kindMit', () => {
  it('leaves out a Spitzname that is none', () => {
    expect(kindMit(4711, ' ')).toEqual({ personId: 4711 });
    expect(kindMit(4711, ' Mimi')).toEqual({
      personId: 4711,
      spitzname: 'Mimi',
    });
  });
});

describe('spitznameZeichen', () => {
  it('counts the trimmed characters, an emoji as one', () => {
    expect(spitznameZeichen(' 🏀👨‍👧 Lu ')).toBe(5);
    expect(spitznameZeichen('   ')).toBe(0);
  });
});
