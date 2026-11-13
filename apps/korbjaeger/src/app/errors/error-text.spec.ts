import { BasketballDataError } from '@wolsok/feat-shared-basketball-data';
import { NoInternetError } from '../basketball-data/no-internet-error';
import { errorText } from './error-text';

describe('errorText', () => {
  it('says nothing while nothing failed', () => {
    expect(errorText(undefined, 'Nicht da.')).toBeUndefined();
  });

  it.each([
    ['not-found', 'Nicht da.'],
    ['offline', 'Keine Verbindung. Internet oder Server nicht erreichbar.'],
    ['unavailable', 'Der DBB ist gerade nicht erreichbar.'],
    ['unexpected-shape', 'Die Daten des DBB ließen sich nicht lesen.'],
  ] as const)('explains a %s error', (kind, text) => {
    expect(
      errorText(new BasketballDataError(kind, 'DBB: nope'), 'Nicht da.')
    ).toContain(text);
  });

  it.each([
    ['offline', 'not-found'],
    ['unavailable', 'offline'],
    ['not-found', 'unavailable'],
  ] as const)('tells a %s error from a %s one', (kind, other) => {
    expect(
      errorText(new BasketballDataError(kind, 'DBB: nope'), 'Nicht da.')
    ).not.toBe(
      errorText(new BasketballDataError(other, 'DBB: nope'), 'Nicht da.')
    );
  });

  it('says there is no internet only where the browser says so', () => {
    const text = errorText(new NoInternetError('/api/dbb/x'), 'Nicht da.');

    expect(text).toContain('Kein Internet.');
    expect(text).not.toBe(
      errorText(new BasketballDataError('offline', 'x'), 'Nicht da.')
    );
  });

  it('takes any other failure for an unreachable DBB', () => {
    expect(errorText(new TypeError('Failed to fetch'), 'Nicht da.')).toContain(
      'Der DBB ist gerade nicht erreichbar.'
    );
  });
});
