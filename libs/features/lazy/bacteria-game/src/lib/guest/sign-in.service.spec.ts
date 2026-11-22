import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  provideRecordingAnalytics,
  RecordingAnalytics,
} from '@wolsok/shared-analytics/testing';
import { ProgressService } from '../progress.service';
import {
  GameAccount,
  PlayerProfile,
  SignInOutcome,
} from '../storage/game-account';
import { SignIn } from './sign-in.service';

describe('SignIn', () => {
  let analytics: RecordingAnalytics;
  let outcome: SignInOutcome;
  let profile: ReturnType<typeof signal<PlayerProfile | null>>;
  let tokenAccepted: boolean;

  beforeEach(() => {
    analytics = new RecordingAnalytics();
    outcome = 'signed-in';
    profile = signal<PlayerProfile | null>({ guest: true, name: null });
    tokenAccepted = true;
    TestBed.configureTestingModule({
      providers: [
        provideRecordingAnalytics(analytics),
        {
          provide: GameAccount,
          useValue: {
            profile,
            signIn: () => Promise.resolve(outcome),
            signInWithToken: () => Promise.resolve(tokenAccepted),
            signOut: () => Promise.resolve(),
          },
        },
        { provide: ProgressService, useValue: { loaded: signal(true) } },
      ],
    });
  });

  it('counts a sign-in with Google', async () => {
    const signIn = TestBed.inject(SignIn);
    await signIn.signIn();

    expect(signIn.signIns()).toBe(1);
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
      expect(signIn.signIns()).toBe(0);
      expect(analytics.events).toEqual([
        { name: 'login_failed', params: { reason: how } },
      ]);
    }
  );

  it('keeps counting successful sign-ins across a cancellation and sign-out', async () => {
    const signIn = TestBed.inject(SignIn);
    await signIn.signIn();
    await signIn.signOut();
    expect(signIn.signIns()).toBe(1);

    outcome = 'cancelled';
    await signIn.signIn();
    expect(signIn.signIns()).toBe(1);

    outcome = 'signed-in';
    await signIn.signIn();
    expect(signIn.signIns()).toBe(2);
  });

  describe('with a Play Games token', () => {
    it('counts a guest that became a signed-in player', async () => {
      const signIn = TestBed.inject(SignIn);
      await signIn.signInWithToken({ value: 'token', uid: 'guest' }, 'guest');

      expect(signIn.signIns()).toBe(1);
      expect(analytics.events).toEqual([
        { name: 'login', params: { method: 'play_games' } },
      ]);
    });

    it('counts no renewed session of a signed-in player', async () => {
      profile.set({ guest: false, name: 'Ada' });
      const signIn = TestBed.inject(SignIn);
      await signIn.signInWithToken({ value: 'token', uid: 'guest' }, 'guest');

      expect(signIn.signIns()).toBe(0);
      expect(analytics.events).toEqual([]);
    });

    it('shows no failure for a refused token', async () => {
      tokenAccepted = false;
      const signIn = TestBed.inject(SignIn);
      await signIn.signInWithToken({ value: 'token', uid: 'guest' }, 'guest');

      expect(signIn.failed()).toBe(false);
      expect(signIn.signIns()).toBe(0);
    });
  });

  it('counts a sign-out', async () => {
    await TestBed.inject(SignIn).signOut();

    expect(analytics.events).toEqual([{ name: 'logout', params: undefined }]);
  });
});
