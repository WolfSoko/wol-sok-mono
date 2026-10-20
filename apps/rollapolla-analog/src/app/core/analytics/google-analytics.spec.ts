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
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { AnalyticsConsent } from './analytics-consent';
import { provideGoogleAnalytics } from './google-analytics';

const analyticsInstance = {};

vi.mock('@angular/fire/analytics', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@angular/fire/analytics')>()),
  getAnalytics: vi.fn(() => analyticsInstance),
  setConsent: vi.fn(),
  setAnalyticsCollectionEnabled: vi.fn(),
}));

describe('provideGoogleAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    document.querySelector('.cdk-overlay-container')?.remove();
  });

  function render(): void {
    TestBed.configureTestingModule({
      providers: [
        provideNoopAnimations(),
        provideFirebaseApp(() => initializeApp({ appId: 'test' })),
        provideGoogleAnalytics(),
      ],
    });
    TestBed.inject(ApplicationRef).tick();
  }

  function banner(): Element | null {
    return document.querySelector('[data-testid="consent-banner"]');
  }

  function click(testId: string): void {
    document
      .querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`)
      ?.click();
  }

  it('asks first and loads nothing before the visitor accepts', () => {
    render();

    expect(banner()).not.toBeNull();
    expect(getAnalytics).not.toHaveBeenCalled();
  });

  it('starts analytics with ads denied once the visitor accepts', () => {
    render();

    click('consent-accept');

    expect(setConsent).toHaveBeenCalledExactlyOnceWith({
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
    expect(getAnalytics).toHaveBeenCalledExactlyOnceWith(
      TestBed.inject(FirebaseApp)
    );
    expect(vi.mocked(setConsent).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(getAnalytics).mock.invocationCallOrder[0]
    );
    expect(localStorage.getItem('rap-analytics-consent')).toBe('granted');
  });

  it('loads nothing when the visitor declines', () => {
    render();

    click('consent-decline');

    expect(getAnalytics).not.toHaveBeenCalled();
    expect(setConsent).not.toHaveBeenCalled();
    expect(localStorage.getItem('rap-analytics-consent')).toBe('denied');
  });

  it('starts analytics right away when granted on an earlier visit', () => {
    localStorage.setItem('rap-analytics-consent', 'granted');

    render();

    expect(banner()).toBeNull();
    expect(getAnalytics).toHaveBeenCalledOnce();
  });

  it('neither asks nor loads when declined on an earlier visit', () => {
    localStorage.setItem('rap-analytics-consent', 'denied');

    render();

    expect(banner()).toBeNull();
    expect(getAnalytics).not.toHaveBeenCalled();
  });

  it('stops collecting when the visitor withdraws consent', () => {
    localStorage.setItem('rap-analytics-consent', 'granted');
    render();
    vi.mocked(setConsent).mockClear();

    TestBed.inject(AnalyticsConsent).decide('denied');

    expect(setConsent).toHaveBeenCalledExactlyOnceWith({
      analytics_storage: 'denied',
    });
    expect(setAnalyticsCollectionEnabled).toHaveBeenCalledExactlyOnceWith(
      analyticsInstance,
      false
    );
    expect(getAnalytics).toHaveBeenCalledOnce();
    expect(localStorage.getItem('rap-analytics-consent')).toBe('denied');
  });

  it('collects again when the visitor grants consent after withdrawing', () => {
    localStorage.setItem('rap-analytics-consent', 'granted');
    render();
    const consent = TestBed.inject(AnalyticsConsent);
    consent.decide('denied');
    vi.mocked(setConsent).mockClear();

    consent.decide('granted');

    expect(setConsent).toHaveBeenCalledExactlyOnceWith({
      analytics_storage: 'granted',
    });
    expect(setAnalyticsCollectionEnabled).toHaveBeenLastCalledWith(
      analyticsInstance,
      true
    );
    expect(getAnalytics).toHaveBeenCalledOnce();
  });
});
