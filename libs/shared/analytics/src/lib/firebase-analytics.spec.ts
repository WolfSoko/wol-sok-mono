import { ApplicationRef, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { initializeApp } from 'firebase/app';
import {
  initializeAnalytics,
  isSupported,
  logEvent,
  setAnalyticsCollectionEnabled,
  setConsent,
  setDefaultEventParameters,
  setUserProperties,
} from 'firebase/analytics';
import { Analytics } from './analytics';
import { ConsentChoice, ConsentPrompt } from './consent';
import { ANALYTICS_CONFIG, MAX_PENDING_COMMANDS } from './firebase-analytics';
import { provideFirebaseAnalytics } from './provide-firebase-analytics';

const analyticsInstance = {};

vi.mock('firebase/analytics', () => ({
  initializeAnalytics: vi.fn(() => analyticsInstance),
  isSupported: vi.fn(async () => true),
  logEvent: vi.fn(),
  setAnalyticsCollectionEnabled: vi.fn(),
  setConsent: vi.fn(),
  setDefaultEventParameters: vi.fn(),
  setUserProperties: vi.fn(),
}));

const STORAGE_KEY = 'test-analytics-consent';
const firebaseApp = initializeApp({ appId: 'test' }, 'analytics-spec');

const GRANTED_DEFAULT = {
  analytics_storage: 'granted',
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
};

@Component({ template: '' })
class PageComponent {}

describe('provideFirebaseAnalytics', () => {
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
        provideRouter([
          { path: '', component: PageComponent },
          { path: 'poll/:pollId', component: PageComponent },
          { path: 'polls', component: PageComponent },
        ]),
        provideFirebaseAnalytics({
          storageKey: STORAGE_KEY,
          app: () => firebaseApp,
        }),
      ],
    });
    TestBed.inject(ApplicationRef).tick();
    await settle();
    return TestBed.inject(ConsentPrompt);
  }

  async function settle(): Promise<void> {
    await vi.dynamicImportSettled();
    await new Promise((resolve) => setTimeout(resolve));
  }

  async function decide(
    consent: ConsentPrompt,
    choice: ConsentChoice
  ): Promise<void> {
    consent.decide(choice);
    await settle();
  }

  async function navigate(url: string): Promise<void> {
    await TestBed.inject(Router).navigateByUrl(url);
    await settle();
  }

  function track(...args: Parameters<Analytics['track']>): Promise<void> {
    TestBed.inject(Analytics).track(...args);
    return settle();
  }

  function loggedEvents(): unknown[][] {
    return vi
      .mocked(logEvent)
      .mock.calls.map(([, name, params]) => [name, params]);
  }

  function setAnalyticsCookies(): void {
    document.cookie = '_ga=GA1.1.1; path=/';
    document.cookie = '_ga_6ZM8TB6QCY=GS1.1.1; path=/';
    document.cookie = 'other=kept; path=/';
  }

  describe('consent', () => {
    it('asks first and loads nothing before the visitor accepts', async () => {
      const consent = await render();

      expect(consent.asking()).toBe(true);
      expect(consent.choice()).toBeNull();
      expect(initializeAnalytics).not.toHaveBeenCalled();
    });

    it('starts analytics with ads denied once the visitor accepts', async () => {
      const consent = await render();

      await decide(consent, 'granted');

      expect(consent.asking()).toBe(false);
      expect(consent.choice()).toBe('granted');
      expect(setConsent).toHaveBeenCalledExactlyOnceWith(GRANTED_DEFAULT);
      expect(initializeAnalytics).toHaveBeenCalledExactlyOnceWith(firebaseApp, {
        config: ANALYTICS_CONFIG,
      });
      expect(vi.mocked(setConsent).mock.invocationCallOrder[0]).toBeLessThan(
        vi.mocked(initializeAnalytics).mock.invocationCallOrder[0]
      );
      expect(localStorage.getItem(STORAGE_KEY)).toBe('granted');
    });

    it('sends neither page views nor Google signals of its own', () => {
      expect(ANALYTICS_CONFIG).toEqual({
        send_page_view: false,
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
      });
    });

    it('loads nothing when the visitor declines', async () => {
      const consent = await render();

      await decide(consent, 'denied');

      expect(consent.asking()).toBe(false);
      expect(consent.choice()).toBe('denied');
      expect(initializeAnalytics).not.toHaveBeenCalled();
      expect(setConsent).not.toHaveBeenCalled();
      expect(localStorage.getItem(STORAGE_KEY)).toBe('denied');
    });

    it('starts analytics right away when granted on an earlier visit', async () => {
      const consent = await render('granted');

      expect(consent.asking()).toBe(false);
      expect(consent.choice()).toBe('granted');
      expect(initializeAnalytics).toHaveBeenCalledOnce();
    });

    it('neither asks nor loads when declined on an earlier visit, and removes old GA cookies', async () => {
      setAnalyticsCookies();

      const consent = await render('denied');

      expect(consent.asking()).toBe(false);
      expect(initializeAnalytics).not.toHaveBeenCalled();
      expect(document.cookie).toBe('other=kept');
    });

    it('asks again on request, keeping the choice in force until a new one', async () => {
      const consent = await render('granted');

      consent.ask();

      expect(consent.asking()).toBe(true);
      expect(consent.choice()).toBe('granted');
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
      expect(initializeAnalytics).toHaveBeenCalledOnce();
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
      expect(initializeAnalytics).toHaveBeenCalledOnce();
    });

    it('starts analytics with ads denied when a visitor who declined accepts', async () => {
      const consent = await render('denied');

      await decide(consent, 'granted');

      expect(setConsent).toHaveBeenCalledExactlyOnceWith(GRANTED_DEFAULT);
      expect(initializeAnalytics).toHaveBeenCalledOnce();
      expect(setAnalyticsCollectionEnabled).not.toHaveBeenCalled();
    });

    it('sends nothing more once the visitor withdraws while the SDK loads', async () => {
      const consent = await render();
      await track('share', { method: 'copy' });

      consent.decide('granted');
      consent.decide('denied');
      await settle();

      expect(logEvent).not.toHaveBeenCalled();
      expect(setAnalyticsCollectionEnabled).toHaveBeenLastCalledWith(
        analyticsInstance,
        false
      );
    });

    it('tries again on the next yes when the SDK could not start', async () => {
      vi.mocked(isSupported).mockResolvedValueOnce(false);
      const consent = await render('granted');
      await decide(consent, 'denied');

      await decide(consent, 'granted');
      await track('share', { method: 'copy' });

      expect(initializeAnalytics).toHaveBeenCalledOnce();
      expect(loggedEvents()).toEqual([['share', { method: 'copy' }]]);
    });

    it('drops the events where the SDK cannot run', async () => {
      vi.mocked(isSupported).mockResolvedValueOnce(false);

      await render('granted');
      await track('share', { method: 'copy' });

      expect(initializeAnalytics).not.toHaveBeenCalled();
      expect(logEvent).not.toHaveBeenCalled();
    });
  });

  describe('events', () => {
    it('sends events with the page they happened on', async () => {
      await render('granted');
      await navigate('/polls');

      await track('share', { method: 'copy', native: false, rank: 2 });

      expect(loggedEvents()).toContainEqual([
        'share',
        {
          page_location: `${location.origin}/polls`,
          page_path: '/polls',
          page_title: '/polls',
          method: 'copy',
          native: 'false',
          rank: 2,
        },
      ]);
    });

    it('leaves out empty values and cuts long ones to what GA4 keeps', async () => {
      await render('granted');

      await track('poll_created', {
        options: undefined,
        listed: null,
        label: 'x'.repeat(120),
      });

      expect(logEvent).toHaveBeenCalledExactlyOnceWith(
        analyticsInstance,
        'poll_created',
        { label: 'x'.repeat(100) }
      );
    });

    it("keeps an event to GA4's 25 parameters, the page included", async () => {
      await render('granted');
      await navigate('/polls');
      const many = Object.fromEntries(
        Array.from({ length: 30 }, (_, i) => [`p${i}`, i])
      );

      await track('share', many);

      const [[, params]] = loggedEvents().filter(([name]) => name === 'share');
      expect(Object.keys(params as object)).toHaveLength(25);
      expect(params).toMatchObject({ page_path: '/polls', p0: 0, p21: 21 });
    });

    it('sends a screen view for a view without a URL', async () => {
      await render('granted');

      TestBed.inject(Analytics).screenView('campaign');
      await settle();

      expect(logEvent).toHaveBeenCalledExactlyOnceWith(
        analyticsInstance,
        'screen_view',
        { firebase_screen: 'campaign', firebase_screen_class: 'campaign' }
      );
    });

    it('sets user properties, cut to the 36 characters GA4 keeps', async () => {
      await render('granted');

      TestBed.inject(Analytics).setUserProperties({
        language: 'de',
        installed: true,
        long: 'y'.repeat(40),
      });
      await settle();

      expect(setUserProperties).toHaveBeenCalledExactlyOnceWith(
        analyticsInstance,
        { language: 'de', installed: 'true', long: 'y'.repeat(36) }
      );
    });

    it('holds the events from before the choice and sends them once the visitor accepts', async () => {
      const consent = await render();
      await track('share', { method: 'copy' });
      expect(logEvent).not.toHaveBeenCalled();

      await decide(consent, 'granted');

      expect(loggedEvents()).toEqual([['share', { method: 'copy' }]]);
    });

    it('holds no more than a bounded number of events', async () => {
      const consent = await render();
      for (let i = 0; i <= MAX_PENDING_COMMANDS; i++) {
        TestBed.inject(Analytics).track('share', { i });
      }

      await decide(consent, 'granted');

      expect(logEvent).toHaveBeenCalledTimes(MAX_PENDING_COMMANDS);
    });

    it('drops the events from before the choice when the visitor declines', async () => {
      const consent = await render();
      await track('share', { method: 'copy' });

      await decide(consent, 'denied');
      await decide(consent, 'granted');

      expect(logEvent).not.toHaveBeenCalled();
    });

    it('sends nothing after the visitor withdrew consent', async () => {
      const consent = await render('granted');
      await decide(consent, 'denied');

      await track('share', { method: 'copy' });

      expect(logEvent).not.toHaveBeenCalled();
    });
  });

  describe('page views', () => {
    it('sends the route pattern instead of the URL, without query or hash', async () => {
      await render('granted');

      await navigate('/poll/abc123?ref=x#friend=uid');

      const page = {
        page_location: `${location.origin}/poll/:pollId`,
        page_path: '/poll/:pollId',
        page_title: '/poll/:pollId',
      };
      expect(setDefaultEventParameters).toHaveBeenLastCalledWith(page);
      expect(loggedEvents()).toContainEqual(['page_view', page]);
    });

    it('counts a page view for each path, not for a query that changes', async () => {
      await render('granted');

      await navigate('/polls');
      await navigate('/polls?q=a');
      await navigate('/polls?q=ab');
      await navigate('/poll/one');
      await navigate('/poll/two');

      expect(
        loggedEvents()
          .filter(([name]) => name === 'page_view')
          .map(([, params]) => (params as { page_path: string }).page_path)
      ).toEqual(['/polls', '/poll/:pollId', '/poll/:pollId']);
    });

    it('holds the first page view until the visitor accepts', async () => {
      const consent = await render();
      await navigate('/polls');
      expect(logEvent).not.toHaveBeenCalled();

      await decide(consent, 'granted');

      expect(loggedEvents()).toEqual([
        [
          'page_view',
          {
            page_location: `${location.origin}/polls`,
            page_path: '/polls',
            page_title: '/polls',
          },
        ],
      ]);
    });
  });
});
