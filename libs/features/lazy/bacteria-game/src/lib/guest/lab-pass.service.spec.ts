import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  provideRecordingAnalytics,
  RecordingAnalytics,
} from '@wolsok/shared-analytics/testing';
import type { Avatar, Profile } from '@wolsok/feat-shared-bacteria-engine';
import { ProgressService } from '../progress.service';
import { SocialService } from '../social/social.service';
import { GameAccount, PlayerProfile } from '../storage/game-account';
import { GuestNotice } from './guest-notice.service';
import { LabPass } from './lab-pass.service';
import { SignIn } from './sign-in.service';

const AVATAR: Avatar = { kind: 'preset', id: 3 };

describe('LabPass', () => {
  let analytics: RecordingAnalytics;
  let player: ReturnType<typeof signal<PlayerProfile | null>>;
  let social: {
    available: boolean;
    profileLoaded: ReturnType<typeof signal<boolean>>;
    storedAvatar: ReturnType<typeof signal<Avatar | null>>;
    profile: ReturnType<typeof signal<Partial<Profile> | null>>;
    friends: ReturnType<typeof signal<unknown[]>>;
  };
  let progress: {
    loaded: ReturnType<typeof signal<boolean>>;
    achievements: ReturnType<typeof signal<Record<string, string>>>;
    grantAchievement: jest.Mock;
  };
  let notice: {
    visible: ReturnType<typeof signal<boolean>>;
    dismissedLately: ReturnType<typeof signal<boolean>>;
    dismiss: jest.Mock;
  };
  let signIns: ReturnType<typeof signal<number>>;

  beforeEach(() => {
    analytics = new RecordingAnalytics();
    player = signal<PlayerProfile | null>({ guest: true, name: null });
    social = {
      available: true,
      profileLoaded: signal(true),
      storedAvatar: signal<Avatar | null>(null),
      profile: signal<Partial<Profile> | null>({ motto: '' }),
      friends: signal<unknown[]>([]),
    };
    progress = {
      loaded: signal(true),
      achievements: signal<Record<string, string>>({}),
      grantAchievement: jest.fn((id: string) => {
        const held = progress.achievements()[id] != null;
        progress.achievements.update((all) => ({ ...all, [id]: '2026-11-21' }));
        return !held;
      }),
    };
    notice = {
      visible: signal(false),
      dismissedLately: signal(false),
      dismiss: jest.fn(),
    };
    signIns = signal(0);
    TestBed.configureTestingModule({
      providers: [
        provideRecordingAnalytics(analytics),
        { provide: GameAccount, useValue: { cloud: true, profile: player } },
        { provide: SocialService, useValue: social },
        { provide: ProgressService, useValue: progress },
        { provide: GuestNotice, useValue: notice },
        { provide: SignIn, useValue: { signIns } },
      ],
    });
  });

  function pass(): LabPass {
    const labPass = TestBed.inject(LabPass);
    TestBed.tick();
    return labPass;
  }

  function completeAll(): void {
    player.set({ guest: false, name: 'Ada' });
    social.storedAvatar.set(AVATAR);
    social.profile.set({ motto: 'Grow or go' });
    social.friends.set([{ uid: 'friend' }]);
  }

  it('shows a guest the pass, signing in first', () => {
    const labPass = pass();

    expect(labPass.visible()).toBe(true);
    expect(labPass.next()).toBe('sign-in');
    expect(labPass.done()).toBe(0);
  });

  it('counts a motto only on a saved profile', () => {
    player.set({ guest: false, name: 'Ada' });
    social.profile.set({ motto: 'Made up' });
    const labPass = pass();

    expect(labPass.done()).toBe(1);
    expect(labPass.next()).toBe('profile');

    social.storedAvatar.set(AVATAR);
    expect(labPass.done()).toBe(3);
    expect(labPass.next()).toBe('friend');
  });

  it('earns Lab Member once the pass is complete, once', () => {
    const labPass = pass();
    completeAll();
    TestBed.tick();

    expect(progress.grantAchievement).toHaveBeenCalledTimes(1);
    expect(labPass.justEarned()).toBe(true);
    expect(labPass.visible()).toBe(true);
    expect(analytics.events).toEqual([
      { name: 'unlock_achievement', params: { achievement_id: 'lab-member' } },
    ]);

    labPass.close();
    TestBed.tick();
    expect(labPass.visible()).toBe(false);
    expect(progress.grantAchievement).toHaveBeenCalledTimes(1);
  });

  it('waits for the progress before it grants', () => {
    progress.loaded.set(false);
    completeAll();
    const labPass = pass();

    expect(progress.grantAchievement).not.toHaveBeenCalled();
    expect(labPass.visible()).toBe(false);

    progress.loaded.set(true);
    TestBed.tick();
    expect(progress.grantAchievement).toHaveBeenCalledTimes(1);
  });

  it('stays away for a player who holds Lab Member', () => {
    progress.achievements.set({ 'lab-member': '2026-01-02' });
    completeAll();
    const labPass = pass();

    expect(labPass.visible()).toBe(false);
    expect(progress.grantAchievement).not.toHaveBeenCalled();
  });

  it('stays away while "Later" holds', () => {
    const labPass = pass();

    labPass.dismiss();
    expect(notice.dismiss).toHaveBeenCalled();
    notice.dismissedLately.set(true);
    expect(labPass.visible()).toBe(false);
  });

  it('is urgent while the guest notice is due', () => {
    const labPass = pass();
    notice.visible.set(true);

    expect(labPass.urgent()).toBe(true);
  });

  it('asks for the onboarding once after a sign-in without a profile', () => {
    const labPass = pass();
    expect(labPass.onboardingDue()).toBe(false);

    player.set({ guest: false, name: 'Ada' });
    signIns.set(1);
    expect(labPass.onboardingDue()).toBe(true);

    labPass.startOnboarding();
    expect(labPass.onboardingDue()).toBe(false);
    expect(labPass.welcoming()).toBe(true);
    labPass.endOnboarding();
    expect(labPass.welcoming()).toBe(false);
  });

  it('asks for no onboarding when the account has a profile', () => {
    const labPass = pass();
    player.set({ guest: false, name: 'Ada' });
    social.storedAvatar.set(AVATAR);
    signIns.set(1);

    expect(labPass.onboardingDue()).toBe(false);
  });
});
