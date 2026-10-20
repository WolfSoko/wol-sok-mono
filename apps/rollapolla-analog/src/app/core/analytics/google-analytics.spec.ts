import { ApplicationRef, PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Analytics, getAnalytics } from '@angular/fire/analytics';
import {
  FirebaseApp,
  initializeApp,
  provideFirebaseApp,
} from '@angular/fire/app';
import { provideGoogleAnalytics } from './google-analytics';

vi.mock('@angular/fire/analytics', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@angular/fire/analytics')>()),
  getAnalytics: vi.fn(() => ({ app: {} })),
}));

describe('provideGoogleAnalytics', () => {
  beforeEach(() => vi.clearAllMocks());

  function setup(enabled: boolean, platformId = 'browser'): void {
    TestBed.configureTestingModule({
      providers: [
        provideFirebaseApp(() => initializeApp({ appId: 'test' }, 'analytics')),
        { provide: PLATFORM_ID, useValue: platformId },
        provideGoogleAnalytics(enabled),
      ],
    });
    TestBed.inject(ApplicationRef).tick();
  }

  it('provides nothing when disabled', () => {
    setup(false);

    expect(TestBed.inject(Analytics, null)).toBeNull();
    expect(getAnalytics).not.toHaveBeenCalled();
  });

  it('creates no instance on the server', () => {
    setup(true, 'server');

    expect(TestBed.inject(Analytics, null)).toBeNull();
    expect(getAnalytics).not.toHaveBeenCalled();
  });

  it('creates the instance for the Firebase app after the first render', () => {
    setup(true);

    expect(getAnalytics).toHaveBeenCalledExactlyOnceWith(
      TestBed.inject(FirebaseApp)
    );
    expect(TestBed.inject(Analytics, null)).not.toBeNull();
  });
});
