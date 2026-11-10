import { BasketballDataError } from '@wolsok/feat-shared-basketball-data';
import { KeinInternetError } from '../basketball-data/kein-internet-error';
import { KEIN_INTERNET, KEINE_VERBINDUNG } from '../fehler/fehler-text';
import {
  CLUB_INDEX_UNAVAILABLE,
  clubIndexFailureText,
} from './club-index-failure-text';

describe('clubIndexFailureText', () => {
  it('says there is no internet where the browser says so', () => {
    expect(clubIndexFailureText(new KeinInternetError('/api/clubs'))).toBe(
      KEIN_INTERNET
    );
  });

  it('says there is no connection where no server answered', () => {
    expect(
      clubIndexFailureText(new BasketballDataError('offline', 'no server'))
    ).toBe(KEINE_VERBINDUNG);
  });

  it.each(['unavailable', 'unexpected-shape', 'not-found'] as const)(
    'names the list, not the DBB, for %s',
    (kind) => {
      expect(clubIndexFailureText(new BasketballDataError(kind, 'x'))).toBe(
        CLUB_INDEX_UNAVAILABLE
      );
    }
  );
});
