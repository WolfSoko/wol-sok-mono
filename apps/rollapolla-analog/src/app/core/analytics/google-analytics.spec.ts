import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  FirebaseApp,
  initializeApp,
  provideFirebaseApp,
} from '@angular/fire/app';
import { initializeAnalytics, setUserProperties } from 'firebase/analytics';
import { BehaviorSubject } from 'rxjs';
import { Account } from '../../../shared/account';
import { AccountPort } from '../../ports/account.port';
import {
  accountKind,
  CONSENT_STORAGE_KEY,
  provideGoogleAnalytics,
} from './google-analytics';

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

const anonymous: Account = {
  uid: 'a',
  isAnonymous: true,
  displayName: null,
  photoUrl: null,
};

describe('provideGoogleAnalytics', () => {
  const account$ = new BehaviorSubject<Account | null>(null);

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    account$.next(null);
  });

  async function render(): Promise<void> {
    localStorage.setItem(CONSENT_STORAGE_KEY, 'granted');
    TestBed.configureTestingModule({
      providers: [
        provideFirebaseApp(() => initializeApp({ appId: 'test' })),
        { provide: AccountPort, useValue: { account$ } },
        provideGoogleAnalytics(),
      ],
    });
    TestBed.inject(ApplicationRef).tick();
    await settle();
  }

  async function settle(): Promise<void> {
    await vi.dynamicImportSettled();
    await new Promise((resolve) => setTimeout(resolve));
  }

  it('starts analytics on the Firebase app, with the choice RollaPolla keeps', async () => {
    await render();

    expect(initializeAnalytics).toHaveBeenCalledExactlyOnceWith(
      TestBed.inject(FirebaseApp),
      expect.anything()
    );
  });

  it('reports the kind of account as it changes', async () => {
    await render();
    account$.next(anonymous);
    account$.next({ ...anonymous, displayName: 'Same kind' });
    account$.next({ ...anonymous, isAnonymous: false });
    await settle();

    expect(vi.mocked(setUserProperties).mock.calls.map(([, p]) => p)).toEqual([
      { account: 'none' },
      { account: 'anonymous' },
      { account: 'google' },
    ]);
  });
});

describe('accountKind', () => {
  it.each([
    [null, 'none'],
    [anonymous, 'anonymous'],
    [{ ...anonymous, isAnonymous: false }, 'google'],
  ] as const)('names %o %s', (account, kind) => {
    expect(accountKind(account)).toBe(kind);
  });
});
