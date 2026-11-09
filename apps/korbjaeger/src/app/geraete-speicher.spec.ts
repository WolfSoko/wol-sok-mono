import { GESPERRTER_SPEICHER, mapSpeicher } from '../testing/speicher';
import {
  ANGEMELDET_SCHLUESSEL,
  flagGesetzt,
  flagSetzen,
} from './geraete-speicher';

describe('the device flags', () => {
  it('sets a flag as "1" and clears it', () => {
    const speicher = mapSpeicher();

    flagSetzen(speicher, ANGEMELDET_SCHLUESSEL, true);
    expect(speicher.getItem(ANGEMELDET_SCHLUESSEL)).toBe('1');
    expect(flagGesetzt(speicher, ANGEMELDET_SCHLUESSEL)).toBe(true);

    flagSetzen(speicher, ANGEMELDET_SCHLUESSEL, false);
    expect(flagGesetzt(speicher, ANGEMELDET_SCHLUESSEL)).toBe(false);
  });

  it('takes only "1" for set', () => {
    const speicher = mapSpeicher();
    speicher.setItem(ANGEMELDET_SCHLUESSEL, 'ja');

    expect(flagGesetzt(speicher, ANGEMELDET_SCHLUESSEL)).toBe(false);
  });

  it('reads no flag and stores none where the device withholds its storage', () => {
    expect(flagGesetzt(GESPERRTER_SPEICHER, ANGEMELDET_SCHLUESSEL)).toBe(false);
    expect(() =>
      flagSetzen(GESPERRTER_SPEICHER, ANGEMELDET_SCHLUESSEL, true)
    ).not.toThrow();
    expect(flagGesetzt(undefined, ANGEMELDET_SCHLUESSEL)).toBe(false);
  });
});
