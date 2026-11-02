import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { I18nService } from './i18n.service';

describe('I18nService', () => {
  beforeEach(() => TestBed.resetTestingModule());

  /** The service on a page whose browser prefers these languages. */
  function withBrowser(...languages: string[]): I18nService {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: DOCUMENT,
          useValue: { defaultView: { navigator: { languages } } },
        },
      ],
    });
    return TestBed.inject(I18nService);
  }

  it('speaks English in the test browser (en-US)', () => {
    const i18n = TestBed.inject(I18nService);

    expect(i18n.language()).toBe('en');
    expect(i18n.locale()).toBe('en-GB');
    expect(i18n.t('settings.title')).toBe('Settings');
  });

  it("follows the browser's language until the player picks one", () => {
    const i18n = withBrowser('de-DE', 'en');

    expect(i18n.choice()).toBeNull();
    expect(i18n.language()).toBe('de');
    expect(i18n.locale()).toBe('de-DE');
    expect(i18n.t('settings.title')).toBe('Einstellungen');

    i18n.setLanguage('en');
    expect(i18n.t('settings.title')).toBe('Settings');

    i18n.setLanguage(null);
    expect(i18n.t('settings.title')).toBe('Einstellungen');
  });

  it('fills placeholders with numbers for the locale', () => {
    const i18n = TestBed.inject(I18nService);
    i18n.setLanguage('de');

    expect(i18n.t('settings.display.cells', { width: 1280, height: 720 })).toBe(
      '1.280 × 720 Zellen'
    );
  });
});
