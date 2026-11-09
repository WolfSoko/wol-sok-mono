import {
  codepunkteVon,
  kindMit,
  SPITZNAME_CODEPUNKTE,
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

  it(`keeps ${SPITZNAME_LAENGE} of the longest emoji the rules know of`, () => {
    // a family with skin tones: 11 code points, one character
    const familie = '👨🏽‍👩🏽‍👧🏽‍👦🏽';
    const voll = familie.repeat(SPITZNAME_LAENGE);

    expect(spitznameAus(voll)).toBe(voll);
    expect(codepunkteVon(voll)).toBeLessThanOrEqual(SPITZNAME_CODEPUNKTE);
  });

  it(`never keeps more than ${SPITZNAME_CODEPUNKTE} code points, the rules' cap`, () => {
    // a character of 20 code points is no emoji, but typed all the same
    const riesig = `a${'\u0301'.repeat(19)}`;

    const gekuerzt = spitznameAus(riesig.repeat(SPITZNAME_LAENGE));

    expect(codepunkteVon(gekuerzt ?? '')).toBeLessThanOrEqual(
      SPITZNAME_CODEPUNKTE
    );
    expect(gekuerzt).toBe(riesig.repeat(Math.floor(SPITZNAME_CODEPUNKTE / 20)));
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
