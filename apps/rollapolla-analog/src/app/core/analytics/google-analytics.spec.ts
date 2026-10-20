import { ApplicationRef } from '@angular/core';
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
  getAnalytics: vi.fn(() => ({})),
}));

describe('provideGoogleAnalytics', () => {
  it('creates the instance for the Firebase app after the first render', () => {
    TestBed.configureTestingModule({
      providers: [
        provideFirebaseApp(() => initializeApp({ appId: 'test' })),
        provideGoogleAnalytics(),
      ],
    });
    expect(getAnalytics).not.toHaveBeenCalled();

    TestBed.inject(ApplicationRef).tick();

    expect(getAnalytics).toHaveBeenCalledExactlyOnceWith(
      TestBed.inject(FirebaseApp)
    );
    expect(TestBed.inject(Analytics, null)).not.toBeNull();
  });
});
