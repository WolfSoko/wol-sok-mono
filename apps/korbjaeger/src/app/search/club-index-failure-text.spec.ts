import { BasketballDataError } from '@wolsok/feat-shared-basketball-data';
import { NoInternetError } from '../basketball-data/no-internet-error';
import { NO_INTERNET, NO_CONNECTION } from '../errors/error-text';
import {
  CLUB_INDEX_UNAVAILABLE,
  clubIndexFailureText,
} from './club-index-failure-text';

describe('clubIndexFailureText', () => {
  it('says there is no internet where the browser says so', () => {
    expect(clubIndexFailureText(new NoInternetError('/api/clubs'))).toBe(
      NO_INTERNET
    );
  });

  it('says there is no connection where no server answered', () => {
    expect(
      clubIndexFailureText(new BasketballDataError('offline', 'no server'))
    ).toBe(NO_CONNECTION);
  });

  it.each(['unavailable', 'unexpected-shape', 'not-found'] as const)(
    'names the list, not the DBB, for %s',
    (child) => {
      expect(clubIndexFailureText(new BasketballDataError(child, 'x'))).toBe(
        CLUB_INDEX_UNAVAILABLE
      );
    }
  );
});
