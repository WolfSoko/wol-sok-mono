import { detectLanguage, isLanguage } from './language';

describe('detectLanguage', () => {
  it('speaks German where the browser prefers it, in any region', () => {
    expect(detectLanguage(['de'])).toBe('de');
    expect(detectLanguage(['de-AT', 'en'])).toBe('de');
    expect(detectLanguage(['DE-ch'])).toBe('de');
  });

  it('speaks English for everything else', () => {
    expect(detectLanguage(['en-US'])).toBe('en');
    expect(detectLanguage(['fr-FR', 'de-DE'])).toBe('en');
    expect(detectLanguage([])).toBe('en');
  });
});

describe('isLanguage', () => {
  it('knows the languages the game speaks, and nothing else', () => {
    expect(isLanguage('en')).toBe(true);
    expect(isLanguage('de')).toBe(true);
    expect(isLanguage('fr')).toBe(false);
    expect(isLanguage(undefined)).toBe(false);
  });
});
