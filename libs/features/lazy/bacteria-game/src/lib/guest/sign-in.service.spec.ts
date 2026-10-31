import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  provideRecordingAnalytics,
  RecordingAnalytics,
} from '@wolsok/shared-analytics/testing';
import { ProgressService } from '../progress.service';
import { GameAccount, SignInOutcome } from '../storage/game-account';
import { SignIn } from './sign-in.service';

describe('SignIn', () => {
  let analytics: RecordingAnalytics;
  let outcome: SignInOutcome;

  beforeEach(() => {
    analytics = new RecordingAnalytics();
    outcome = 'signed-in';
    TestBed.configureTestingModule({
      providers: [
        provideRecordingAnalytics(analytics),
        {
          provide: GameAccount,
          useValue: {
            signIn: () => Promise.resolve(outcome),
            signOut: () => Promise.resolve(),
          },
        },
        { provide: ProgressService, useValue: { loaded: signal(true) } },
      ],
    });
  });

  it('counts a sign-in with Google', async () => {
    await TestBed.inject(SignIn).signIn();

    expect(analytics.events).toEqual([
      { name: 'login', params: { method: 'google' } },
    ]);
  });

  it.each(['cancelled', 'failed'] as const)(
    'counts a sign-in that was %s',
    async (how) => {
      outcome = how;
      const signIn = TestBed.inject(SignIn);

      await signIn.signIn();

      expect(signIn.failed()).toBe(how === 'failed');
      expect(analytics.events).toEqual([
        { name: 'login_failed', params: { reason: how } },
      ]);
    }
  );

  it('counts a sign-out', async () => {
    await TestBed.inject(SignIn).signOut();

    expect(analytics.events).toEqual([{ name: 'logout', params: undefined }]);
  });
});
