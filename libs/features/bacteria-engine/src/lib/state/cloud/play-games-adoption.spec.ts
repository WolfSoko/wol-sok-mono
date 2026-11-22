import {
  isAdoptionNonce,
  parsePlayGamesAdoption,
  PLAY_GAMES_NONCE_LENGTH,
} from './play-games-adoption';

const NONCE = 'a'.repeat(PLAY_GAMES_NONCE_LENGTH);

describe('the Play Games adoption', () => {
  describe('parsePlayGamesAdoption', () => {
    it('reads from and nonce, with the document’s own fields beside them', () => {
      expect(
        parsePlayGamesAdoption({
          uid: 'b',
          createdAt: 1,
          expireAt: 2,
          from: 'a',
          nonce: NONCE,
          result: { ok: true },
        })
      ).toEqual({ from: 'a', nonce: NONCE });
    });

    it('refuses a missing or foreign from, a bad nonce or an extra field', () => {
      expect(parsePlayGamesAdoption({ nonce: NONCE })).toBeNull();
      expect(parsePlayGamesAdoption({ from: '', nonce: NONCE })).toBeNull();
      expect(parsePlayGamesAdoption({ from: 'a/b', nonce: NONCE })).toBeNull();
      expect(parsePlayGamesAdoption({ from: 'a' })).toBeNull();
      expect(parsePlayGamesAdoption({ from: 'a', nonce: 'short' })).toBeNull();
      expect(
        parsePlayGamesAdoption({ from: 'a', nonce: NONCE, extra: 1 })
      ).toBeNull();
      expect(parsePlayGamesAdoption('a')).toBeNull();
    });
  });

  describe('isAdoptionNonce', () => {
    it('takes exactly the hex nonce the tab makes', () => {
      expect(isAdoptionNonce(NONCE)).toBe(true);
      expect(isAdoptionNonce('A'.repeat(PLAY_GAMES_NONCE_LENGTH))).toBe(false);
      expect(isAdoptionNonce(`${NONCE}0`)).toBe(false);
      expect(isAdoptionNonce(7)).toBe(false);
    });
  });
});
