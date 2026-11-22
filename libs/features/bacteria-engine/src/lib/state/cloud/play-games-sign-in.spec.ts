import {
  PLAY_GAMES_CODE_MAX,
  parsePlayGamesSignIn,
  playGamesCodeOf,
} from './play-games-sign-in';

describe('the Play Games sign-in', () => {
  describe('parsePlayGamesSignIn', () => {
    it('reads the code, with the document’s own fields beside it', () => {
      expect(
        parsePlayGamesSignIn({
          uid: 'a',
          createdAt: 1,
          expireAt: 2,
          code: '4/0Ab',
          result: { ok: true },
          token: 't',
        })
      ).toEqual({ code: '4/0Ab' });
    });

    it('refuses a missing, empty, too long or foreign code', () => {
      expect(parsePlayGamesSignIn({ uid: 'a' })).toBeNull();
      expect(parsePlayGamesSignIn({ code: '' })).toBeNull();
      expect(parsePlayGamesSignIn({ code: 7 })).toBeNull();
      expect(
        parsePlayGamesSignIn({ code: 'x'.repeat(PLAY_GAMES_CODE_MAX + 1) })
      ).toBeNull();
      expect(parsePlayGamesSignIn('code')).toBeNull();
    });

    it('refuses an extra field', () => {
      expect(parsePlayGamesSignIn({ code: 'c', uid2: 'b' })).toBeNull();
    });
  });

  describe('playGamesCodeOf', () => {
    it('takes the code from the fragment, decoded', () => {
      expect(playGamesCodeOf('#play-games=4%2F0Ab-c')).toBe('4/0Ab-c');
      expect(playGamesCodeOf('play-games=4/0Ab')).toBe('4/0Ab');
    });

    it('is null without a code, or for one the rules refuse', () => {
      expect(playGamesCodeOf('')).toBeNull();
      expect(playGamesCodeOf('#friend=abc')).toBeNull();
      expect(playGamesCodeOf('#play-games=')).toBeNull();
      expect(
        playGamesCodeOf(`#play-games=${'x'.repeat(PLAY_GAMES_CODE_MAX + 1)}`)
      ).toBeNull();
    });
  });
});
