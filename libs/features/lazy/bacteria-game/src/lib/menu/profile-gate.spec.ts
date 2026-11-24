import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NEVER } from 'rxjs';
import { FakeGameAccount } from '../../testing/fake-game-account';
import { EvolutionService } from '../evolution.service';
import { ProgressService } from '../progress.service';
import { GameSettingsService } from '../settings.service';
import { SocialService } from '../social/social.service';
import { GameAccount } from '../storage/game-account';
import {
  PROFILE_WAIT_MS,
  ProfileGate,
  type ProfileSources,
  profileKnown,
} from './profile-gate';

const KNOWN: ProfileSources = {
  settings: true,
  progress: true,
  evolution: true,
  cloud: true,
  account: true,
  social: true,
  socialLoaded: true,
};

describe('profileKnown', () => {
  it('is true once every source has answered', () => {
    expect(profileKnown(KNOWN)).toBe(true);
  });

  it.each(['settings', 'progress', 'evolution', 'account', 'socialLoaded'])(
    'waits for %s',
    (source) => {
      expect(profileKnown({ ...KNOWN, [source]: false })).toBe(false);
    }
  );

  it('ignores the account and the social profile without the cloud', () => {
    expect(
      profileKnown({
        ...KNOWN,
        cloud: false,
        account: false,
        socialLoaded: false,
      })
    ).toBe(true);
  });

  it('ignores the social profile where the cloud has none', () => {
    expect(profileKnown({ ...KNOWN, social: false, socialLoaded: false })).toBe(
      true
    );
  });
});

describe('ProfileGate', () => {
  let account: FakeGameAccount;
  const settings = signal(false);
  const progress = signal(false);
  const evolution = signal(false);
  const socialLoaded = signal(false);

  function create(
    gameAccount: Partial<GameAccount> = new FakeGameAccount()
  ): ProfileGate {
    account = gameAccount as FakeGameAccount;
    TestBed.configureTestingModule({
      providers: [
        { provide: GameAccount, useValue: gameAccount },
        { provide: GameSettingsService, useValue: { loaded: settings } },
        { provide: ProgressService, useValue: { loaded: progress } },
        { provide: EvolutionService, useValue: { loaded: evolution } },
        {
          provide: SocialService,
          useValue: { available: true, profileLoaded: socialLoaded },
        },
      ],
    });
    return TestBed.inject(ProfileGate);
  }

  function answerAll(): void {
    account.profile.set({ guest: true, name: null });
    settings.set(true);
    progress.set(true);
    evolution.set(true);
    socialLoaded.set(true);
  }

  beforeEach(() => {
    jest.useFakeTimers();
    for (const flag of [settings, progress, evolution, socialLoaded]) {
      flag.set(false);
    }
  });

  afterEach(() => jest.useRealTimers());

  it('stays closed until the profile is known', () => {
    const gate = create();
    expect(gate.ready()).toBe(false);

    answerAll();

    expect(gate.ready()).toBe(true);
  });

  it('opens after a while when a source keeps silent', () => {
    const gate = create();

    jest.advanceTimersByTime(PROFILE_WAIT_MS - 1);
    expect(gate.ready()).toBe(false);
    jest.advanceTimersByTime(1);

    expect(gate.ready()).toBe(true);
  });

  it('opens after a while when no player ever turns up', () => {
    // A first guest whose sign-in failed: the account sends no switch.
    const gate = create({ cloud: true, profile: signal(null), players: NEVER });

    jest.advanceTimersByTime(PROFILE_WAIT_MS);

    expect(gate.ready()).toBe(true);
  });

  it('closes on a player switch and waits again', () => {
    const gate = create();
    jest.advanceTimersByTime(PROFILE_WAIT_MS);
    expect(gate.ready()).toBe(true);

    account.switchTo('google');

    expect(gate.ready()).toBe(false);
    jest.advanceTimersByTime(PROFILE_WAIT_MS);
    expect(gate.ready()).toBe(true);
  });
});
