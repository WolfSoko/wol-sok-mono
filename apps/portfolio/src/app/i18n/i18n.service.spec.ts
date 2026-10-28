import { TestBed } from '@angular/core/testing';
import { I18nService, LANGUAGE_STORAGE_KEY } from './i18n.service';
import { detectLanguage } from './language';

describe('detectLanguage', () => {
  it('speaks German to a German browser and English to the rest', () => {
    expect(detectLanguage(['de-DE', 'en'])).toBe('de');
    expect(detectLanguage(['DE'])).toBe('de');
    expect(detectLanguage(['en-US', 'de'])).toBe('en');
    expect(detectLanguage(['fr'])).toBe('en');
    expect(detectLanguage([])).toBe('en');
  });
});

describe('I18nService', () => {
  afterEach(() => localStorage.clear());

  function create(): I18nService {
    TestBed.configureTestingModule({});
    return TestBed.inject(I18nService);
  }

  it('starts with the stored choice', () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'de');
    const i18n = create();
    expect(i18n.language()).toBe('de');
    expect(i18n.texts().nav.career).toBe('Werdegang');
    expect(i18n.locale()).toBe('de-DE');
  });

  it('ignores a stored value that is no language', () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'fr');
    expect(create().choice()).toBeNull();
  });

  it('stores a choice and sets the document language', () => {
    const i18n = create();
    i18n.setLanguage('de');
    TestBed.tick();
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('de');
    expect(document.documentElement.lang).toBe('de');
    expect(i18n.pick({ en: 'cat', de: 'Katze' })).toBe('Katze');

    i18n.setLanguage(null);
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBeNull();
    expect(i18n.choice()).toBeNull();
  });

  it('fills placeholders formatted for the locale', () => {
    const i18n = create();
    i18n.setLanguage('de');
    expect(
      i18n.fill('{count} Monate seit {year}', { count: 1234, year: '2008' })
    ).toBe('1.234 Monate seit 2008');
  });
});
