import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  provideRecordingAnalytics,
  RecordingAnalytics,
} from '@wolsok/shared-analytics/testing';
import type { Avatar, Profile } from '@wolsok/feat-shared-bacteria-engine';
import { ProgressService } from '../progress.service';
import { SocialService } from '../social/social.service';
import { Subject } from 'rxjs';
import {
  GameAccount,
  PlayerProfile,
  PlayerSwitch,
} from '../storage/game-account';
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
    known: ReturnType<typeof signal<boolean>>;
    visible: ReturnType<typeof signal<boolean>>;
    cameBack: ReturnType<typeof signal<boolean>>;
    dismissedLately: ReturnType<typeof signal<boolean>>;
    dismiss: jest.Mock;
  };
  let signIns: ReturnType<typeof signal<number>>;
  let players: Subject<PlayerSwitch>;

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
      known: signal(true),
      visible: signal(false),
      cameBack: signal(false),
      dismissedLately: signal(false),
      dismiss: jest.fn(),
    };
    signIns = signal(0);
    players = new Subject<PlayerSwitch>();
    TestBed.configureTestingModule({
      providers: [
        provideRecordingAnalytics(analytics),
        {
          provide: GameAccount,
          useValue: { cloud: true, profile: player, players },
        },
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

  it('keeps the announcement from the next player', () => {
    const labPass = pass();
    completeAll();
    TestBed.tick();
    expect(labPass.justEarned()).toBe(true);

    players.next({ playerId: 'next-guest', adoptsGuest: false });

    expect(labPass.justEarned()).toBe(false);
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

  it('does not announce a reward when the grant is declined', () => {
    progress.grantAchievement.mockReturnValue(false);
    completeAll();
    const labPass = pass();

    expect(progress.grantAchievement).toHaveBeenCalledWith('lab-member');
    expect(labPass.justEarned()).toBe(false);
    expect(analytics.events).toEqual([]);
  });

  it('waits for a confirmed profile even when all other steps are done', () => {
    completeAll();
    social.profileLoaded.set(false);
    const labPass = pass();

    expect(labPass.next()).toBe('profile');
    expect(progress.grantAchievement).not.toHaveBeenCalled();

    social.profileLoaded.set(true);
    TestBed.tick();

    expect(labPass.justEarned()).toBe(true);
  });

  it('stays away for a player who holds Lab Member', () => {
    progress.achievements.set({ 'lab-member': '2026-01-02' });
    completeAll();
    const labPass = pass();

    expect(labPass.visible()).toBe(false);
    expect(progress.grantAchievement).not.toHaveBeenCalled();
  });

  it('waits for the device and the profile before it shows', () => {
    notice.known.set(false);
    social.profileLoaded.set(false);
    const labPass = pass();
    expect(labPass.visible()).toBe(false);

    notice.known.set(true);
    expect(labPass.visible()).toBe(false);
    social.profileLoaded.set(true);
    expect(labPass.visible()).toBe(true);
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

    // The new player's profile has not answered yet.
    social.profileLoaded.set(false);
    player.set({ guest: false, name: 'Ada' });
    signIns.set(1);
    TestBed.tick();
    expect(labPass.onboardingDue()).toBe(false);

    social.profileLoaded.set(true);
    TestBed.tick();
    expect(labPass.onboardingDue()).toBe(true);

    labPass.startOnboarding();
    TestBed.tick();
    expect(labPass.onboardingDue()).toBe(false);
    expect(labPass.welcoming()).toBe(true);
    expect(labPass.editorFocus()).toBe('name');
    labPass.editorFocused();
    labPass.endOnboarding();
    expect(labPass.welcoming()).toBe(false);
    expect(labPass.editorFocus()).toBeNull();
  });

  it('drops the onboarding of a sign-in the player moved on from', () => {
    const labPass = pass();
    // Signed in, then off to another screen before the profile answered.
    social.profileLoaded.set(false);
    player.set({ guest: false, name: 'Ada' });
    signIns.set(1);
    TestBed.tick();
    labPass.moveOn();
    social.profileLoaded.set(true);
    TestBed.tick();
    expect(labPass.onboardingDue()).toBe(false);

    // Due already, but no screen took it before the player moved on.
    signIns.set(2);
    TestBed.tick();
    expect(labPass.onboardingDue()).toBe(true);
    labPass.moveOn();
    expect(labPass.onboardingDue()).toBe(false);
  });

  it('keeps the welcome the profile shows when the menu moves on to it', () => {
    const labPass = pass();
    labPass.startOnboarding();
    labPass.moveOn();

    expect(labPass.welcoming()).toBe(true);
    expect(labPass.editorFocus()).toBe('name');
  });

  it('settles a sign-in onto an account with a profile for good', () => {
    const labPass = pass();
    player.set({ guest: false, name: 'Ada' });
    social.storedAvatar.set(AVATAR);
    signIns.set(1);
    TestBed.tick();
    expect(labPass.onboardingDue()).toBe(false);

    // Later in the visit the profile step opens again: no onboarding.
    social.storedAvatar.set(null);
    TestBed.tick();
    expect(labPass.onboardingDue()).toBe(false);
  });

  it('checks a new sign-in after an earlier sign-in needed no onboarding', () => {
    const labPass = pass();
    player.set({ guest: false, name: 'Ada' });
    social.storedAvatar.set(AVATAR);
    signIns.set(1);
    TestBed.tick();
    expect(labPass.onboardingDue()).toBe(false);

    player.set({ guest: false, name: 'Cleo' });
    social.storedAvatar.set(null);
    signIns.set(2);
    TestBed.tick();

    expect(labPass.onboardingDue()).toBe(true);
  });

  it('grants nothing for the friends of the player before a switch', () => {
    // The guest had a friend; the account signed in to has a profile with
    // a motto, its friends not yet read: SocialService starts them empty.
    social.friends.set([{ uid: 'friend' }]);
    const labPass = pass();
    player.set({ guest: false, name: 'Ada' });
    social.storedAvatar.set(AVATAR);
    social.profile.set({ motto: 'Grow or go' });
    social.friends.set([]);
    TestBed.tick();

    expect(labPass.next()).toBe('friend');
    expect(progress.grantAchievement).not.toHaveBeenCalled();
  });
});
