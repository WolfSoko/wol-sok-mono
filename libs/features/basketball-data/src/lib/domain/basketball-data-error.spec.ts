import {
  BasketballDataError,
  isBasketballDataError,
} from './basketball-data-error';

describe('BasketballDataError', () => {
  it('carries its kind, message and cause', () => {
    const cause = new Error('socket hang up');

    const error = new BasketballDataError('unavailable', 'DBB down', { cause });

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('BasketballDataError');
    expect(error.kind).toBe('unavailable');
    expect(error.message).toBe('DBB down');
    expect(error.cause).toBe(cause);
  });

  it('is recognised, by kind when one is asked for', () => {
    const error = new BasketballDataError('not-found', 'no such Liga');

    expect(isBasketballDataError(error)).toBe(true);
    expect(isBasketballDataError(error, 'not-found')).toBe(true);
    expect(isBasketballDataError(error, 'unavailable')).toBe(false);
    expect(isBasketballDataError(new Error('other'))).toBe(false);
  });
});
