import {
  codePointsOf,
  childWith,
  NICKNAME_CODE_POINTS,
  NICKNAME_LENGTH,
  nicknameOf,
  nicknameCharacterCount,
} from './child';

describe('spitznameAus', () => {
  it('trims the Spitzname', () => {
    expect(nicknameOf('  Mimi ')).toBe('Mimi');
  });

  it.each([[''], ['   '], [undefined]])('takes %j for none', (input) => {
    expect(nicknameOf(input)).toBeUndefined();
  });

  it(`keeps at most ${NICKNAME_LENGTH} characters, an emoji as one`, () => {
    const long = `🏀👨‍👧${'a'.repeat(40)}`;

    expect(nicknameOf(long)).toBe(`🏀👨‍👧${'a'.repeat(NICKNAME_LENGTH - 2)}`);
  });

  it(`keeps ${NICKNAME_LENGTH} of the longest emoji the rules know of`, () => {
    // a family with skin tones: 11 code points, one character
    const family = '👨🏽‍👩🏽‍👧🏽‍👦🏽';
    const full = family.repeat(NICKNAME_LENGTH);

    expect(nicknameOf(full)).toBe(full);
    expect(codePointsOf(full)).toBeLessThanOrEqual(NICKNAME_CODE_POINTS);
  });

  it(`never keeps more than ${NICKNAME_CODE_POINTS} code points, the rules' cap`, () => {
    // a character of 20 code points is no emoji, but typed all the same
    const huge = `a${'\u0301'.repeat(19)}`;

    const shortened = nicknameOf(huge.repeat(NICKNAME_LENGTH));

    expect(codePointsOf(shortened ?? '')).toBeLessThanOrEqual(
      NICKNAME_CODE_POINTS
    );
    expect(shortened).toBe(huge.repeat(Math.floor(NICKNAME_CODE_POINTS / 20)));
  });
});

describe('kindMit', () => {
  it('leaves out a Spitzname that is none', () => {
    expect(childWith(4711, ' ')).toEqual({ personId: 4711 });
    expect(childWith(4711, ' Mimi')).toEqual({
      personId: 4711,
      nickname: 'Mimi',
    });
  });
});

describe('spitznameZeichen', () => {
  it('counts the trimmed characters, an emoji as one', () => {
    expect(nicknameCharacterCount(' 🏀👨‍👧 Lu ')).toBe(5);
    expect(nicknameCharacterCount('   ')).toBe(0);
  });
});
