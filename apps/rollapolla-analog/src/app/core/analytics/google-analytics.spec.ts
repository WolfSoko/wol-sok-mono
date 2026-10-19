import { Component, PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Analytics, logEvent } from '@angular/fire/analytics';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { Title } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { provideGoogleAnalytics } from './google-analytics';

vi.mock('@angular/fire/analytics', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@angular/fire/analytics')>()),
  getAnalytics: vi.fn(() => ({ app: {} })),
  logEvent: vi.fn(),
}));

@Component({ template: '' })
class PageComponent {}

describe('provideGoogleAnalytics', () => {
  function setup(enabled: boolean, platformId = 'browser'): void {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'polls', component: PageComponent }]),
        provideFirebaseApp(() => initializeApp({ appId: 'test' }, 'analytics')),
        { provide: PLATFORM_ID, useValue: platformId },
        provideGoogleAnalytics(enabled),
      ],
    });
  }

  it('provides nothing when disabled', async () => {
    setup(false);

    expect(TestBed.inject(Analytics, null)).toBeNull();
    await TestBed.inject(Router).navigateByUrl('/polls');
    expect(logEvent).not.toHaveBeenCalled();
  });

  it('has no analytics instance on the server', async () => {
    setup(true, 'server');

    expect(TestBed.inject(Analytics, null)).toBeNull();
    await TestBed.inject(Router).navigateByUrl('/polls');
    expect(logEvent).not.toHaveBeenCalled();
  });

  it('logs a screen view per navigation in the browser', async () => {
    setup(true);
    const analytics = TestBed.inject(Analytics);
    TestBed.inject(Title).setTitle('Browse polls');

    await TestBed.inject(Router).navigateByUrl('/polls?order=hot');

    expect(logEvent).toHaveBeenCalledExactlyOnceWith(analytics, 'screen_view', {
      firebase_screen: '/polls?order=hot',
      firebase_screen_class: 'Browse polls',
    });
  });
});
