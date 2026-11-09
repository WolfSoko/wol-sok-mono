import { BasketballDataError } from '@wolsok/feat-shared-basketball-data';
import { KeinInternetError } from '../basketball-data/kein-internet-error';
import { fehlerText } from './fehler-text';

describe('fehlerText', () => {
  it('says nothing while nothing failed', () => {
    expect(fehlerText(undefined, 'Nicht da.')).toBeUndefined();
  });

  it.each([
    ['not-found', 'Nicht da.'],
    ['offline', 'Keine Verbindung. Internet oder Server nicht erreichbar.'],
    ['unavailable', 'Der DBB ist gerade nicht erreichbar.'],
    ['unexpected-shape', 'Die Daten des DBB ließen sich nicht lesen.'],
  ] as const)('explains a %s error', (kind, text) => {
    expect(
      fehlerText(new BasketballDataError(kind, 'DBB: nope'), 'Nicht da.')
    ).toContain(text);
  });

  it.each([
    ['offline', 'not-found'],
    ['unavailable', 'offline'],
    ['not-found', 'unavailable'],
  ] as const)('tells a %s error from a %s one', (kind, other) => {
    expect(
      fehlerText(new BasketballDataError(kind, 'DBB: nope'), 'Nicht da.')
    ).not.toBe(
      fehlerText(new BasketballDataError(other, 'DBB: nope'), 'Nicht da.')
    );
  });

  it('says there is no internet only where the browser says so', () => {
    const text = fehlerText(new KeinInternetError('/api/dbb/x'), 'Nicht da.');

    expect(text).toContain('Kein Internet.');
    expect(text).not.toBe(
      fehlerText(new BasketballDataError('offline', 'x'), 'Nicht da.')
    );
  });

  it('takes any other failure for an unreachable DBB', () => {
    expect(fehlerText(new TypeError('Failed to fetch'), 'Nicht da.')).toContain(
      'Der DBB ist gerade nicht erreichbar.'
    );
  });
});
