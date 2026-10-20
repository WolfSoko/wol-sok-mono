import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  getAnalytics,
  setAnalyticsCollectionEnabled,
  setConsent,
} from '@angular/fire/analytics';
import {
  FirebaseApp,
  initializeApp,
  provideFirebaseApp,
} from '@angular/fire/app';
import { ConsentChoice, ConsentPrompt } from './consent';
import { provideGoogleAnalytics } from './google-analytics';

const analyticsInstance = {};

vi.mock('@angular/fire/analytics', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@angular/fire/analytics')>()),
  getAnalytics: vi.fn(() => analyticsInstance),
  setConsent: vi.fn(),
  setAnalyticsCollectionEnabled: vi.fn(),
}));

const STORAGE_KEY = 'rap-analytics-consent';

const GRANTED_DEFAULT = {
  analytics_storage: 'granted',
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
};

describe('provideGoogleAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    document.cookie = 'other=; max-age=0; path=/';
  });

  /** Renders once, with the choice stored on an earlier visit. */
  async function render(stored?: ConsentChoice): Promise<ConsentPrompt> {
    if (stored) {
      localStorage.setItem(STORAGE_KEY, stored);
    }
    TestBed.configureTestingModule({
      providers: [
        provideFirebaseApp(() => initializeApp({ appId: 'test' })),
        provideGoogleAnalytics(),
      ],
    });
    TestBed.inject(ApplicationRef).tick();
    await vi.dynamicImportSettled();
    return TestBed.inject(ConsentPrompt);
  }

  async function decide(
    consent: ConsentPrompt,
    choice: ConsentChoice
  ): Promise<void> {
    consent.decide(choice);
    await vi.dynamicImportSettled();
  }

  function setAnalyticsCookies(): void {
    document.cookie = '_ga=GA1.1.1; path=/';
    document.cookie = '_ga_6ZM8TB6QCY=GS1.1.1; path=/';
    document.cookie = 'other=kept; path=/';
  }

  it('asks first and loads nothing before the visitor accepts', async () => {
    const consent = await render();

    expect(consent.asking()).toBe(true);
    expect(getAnalytics).not.toHaveBeenCalled();
  });

  it('starts analytics with ads denied once the visitor accepts', async () => {
    const consent = await render();

    await decide(consent, 'granted');

    expect(consent.asking()).toBe(false);
    expect(setConsent).toHaveBeenCalledExactlyOnceWith(GRANTED_DEFAULT);
    expect(getAnalytics).toHaveBeenCalledExactlyOnceWith(
      TestBed.inject(FirebaseApp)
    );
    expect(vi.mocked(setConsent).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(getAnalytics).mock.invocationCallOrder[0]
    );
    expect(localStorage.getItem(STORAGE_KEY)).toBe('granted');
  });

  it('loads nothing when the visitor declines', async () => {
    const consent = await render();

    await decide(consent, 'denied');

    expect(consent.asking()).toBe(false);
    expect(getAnalytics).not.toHaveBeenCalled();
    expect(setConsent).not.toHaveBeenCalled();
    expect(localStorage.getItem(STORAGE_KEY)).toBe('denied');
  });

  it('starts analytics right away when granted on an earlier visit', async () => {
    const consent = await render('granted');

    expect(consent.asking()).toBe(false);
    expect(getAnalytics).toHaveBeenCalledOnce();
  });

  it('neither asks nor loads when declined on an earlier visit, and removes old GA cookies', async () => {
    setAnalyticsCookies();

    const consent = await render('denied');

    expect(consent.asking()).toBe(false);
    expect(getAnalytics).not.toHaveBeenCalled();
    expect(document.cookie).toBe('other=kept');
  });

  it('stops collecting and removes the GA cookies when the visitor withdraws consent', async () => {
    const consent = await render('granted');
    setAnalyticsCookies();
    vi.mocked(setConsent).mockClear();

    await decide(consent, 'denied');

    expect(setConsent).toHaveBeenCalledExactlyOnceWith({
      analytics_storage: 'denied',
    });
    expect(setAnalyticsCollectionEnabled).toHaveBeenCalledExactlyOnceWith(
      analyticsInstance,
      false
    );
    expect(document.cookie).toBe('other=kept');
    expect(getAnalytics).toHaveBeenCalledOnce();
    expect(localStorage.getItem(STORAGE_KEY)).toBe('denied');
  });

  it('collects again when the visitor grants consent after withdrawing', async () => {
    const consent = await render('granted');
    await decide(consent, 'denied');
    vi.mocked(setConsent).mockClear();

    await decide(consent, 'granted');

    expect(setConsent).toHaveBeenCalledExactlyOnceWith({
      analytics_storage: 'granted',
    });
    expect(setAnalyticsCollectionEnabled).toHaveBeenLastCalledWith(
      analyticsInstance,
      true
    );
    expect(getAnalytics).toHaveBeenCalledOnce();
  });

  it('starts analytics with ads denied when a visitor who declined accepts', async () => {
    const consent = await render('denied');

    await decide(consent, 'granted');

    expect(setConsent).toHaveBeenCalledExactlyOnceWith(GRANTED_DEFAULT);
    expect(getAnalytics).toHaveBeenCalledOnce();
    expect(setAnalyticsCollectionEnabled).not.toHaveBeenCalled();
  });
});
