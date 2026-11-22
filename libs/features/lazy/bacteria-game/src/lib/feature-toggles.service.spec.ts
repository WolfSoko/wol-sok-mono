import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { provideGameToggles } from '../testing/fake-game-toggles';
import { FeatureTogglesService } from './feature-toggles.service';
import {
  FEATURE_TOGGLES,
  type FeatureToggleStates,
  resolveToggles,
} from '@wolsok/feat-shared-bacteria-engine/cloud';
import { FakeGameAccount } from '../testing/fake-game-account';
import { GameAccount } from './storage/game-account';
import { GameCloud } from './storage/game-cloud';
import { GameToggles } from './storage/game-toggles';
import type { FirebaseConnection } from './storage/firebase-connection';

describe('FeatureTogglesService', () => {
  let set: Subject<Partial<FeatureToggleStates>>;
  let account: FakeGameAccount;
  const DEFAULTS = resolveToggles(FEATURE_TOGGLES, false);

  function withToggles(): FeatureTogglesService {
    set = new Subject();
    account = new FakeGameAccount();
    TestBed.configureTestingModule({
      providers: [
        provideGameToggles(set),
        { provide: GameAccount, useValue: account },
      ],
    });
    return TestBed.inject(FeatureTogglesService);
  }

  beforeEach(() => TestBed.resetTestingModule());

  it('starts at the defaults, before Remote Config answers', () => {
    const service = withToggles();
    expect(service.states()).toEqual(FEATURE_TOGGLES);
    expect(service.toggles()).toEqual(DEFAULTS);
    expect(service.toggles().bacteriumMenu).toBe(false);
  });

  it('takes what the owner set, the defaults for the rest', () => {
    const service = withToggles();

    set.next({ matchmaking: 'off', deterministicSimulation: 'off' });

    expect(service.toggles()).toEqual({
      ...DEFAULTS,
      matchmaking: false,
      deterministicSimulation: false,
    });
  });

  it('turns an admin toggle on for the owner only, as they sign in or out', () => {
    const service = withToggles();
    set.next({ bacteriumMenu: 'admin', leaderboards: 'admin' });

    expect(service.toggles().bacteriumMenu).toBe(false);
    expect(service.toggles().leaderboards).toBe(false);

    account.owner.set(true);
    expect(service.toggles().bacteriumMenu).toBe(true);
    expect(service.toggles().leaderboards).toBe(true);

    account.owner.set(false);
    expect(service.toggles().bacteriumMenu).toBe(false);
  });

  it('turns an on toggle on for everyone', () => {
    const service = withToggles();
    set.next({ bacteriumMenu: 'on' });

    expect(service.toggles().bacteriumMenu).toBe(true);
  });

  it('asks the port only once started, and once however often started', () => {
    const watch = jest.fn(() => new Subject<Partial<FeatureToggleStates>>());
    TestBed.configureTestingModule({
      providers: [{ provide: GameToggles, useValue: { watch } }],
    });
    const service = TestBed.inject(FeatureTogglesService);
    expect(watch).not.toHaveBeenCalled();

    service.start();
    service.start();

    expect(watch).toHaveBeenCalledTimes(1);
  });

  it('has the defaults without a project', () => {
    const service = TestBed.inject(FeatureTogglesService);
    service.start();

    expect(service.toggles()).toEqual(DEFAULTS);
  });

  it("has what the project's Remote Config says", async () => {
    TestBed.configureTestingModule({
      providers: [{ provide: GameAccount, useValue: new FakeGameAccount() }],
    });
    TestBed.inject(GameCloud).use({
      remoteConfig: async () => ({
        config: {},
        sdk: {
          getValue: (_config: unknown, key: string) => ({
            asString: () => (key === 'leaderboards' ? 'false' : ''),
            getSource: () => (key === 'leaderboards' ? 'remote' : 'static'),
          }),
        },
      }),
    } as unknown as FirebaseConnection);
    const service = TestBed.inject(FeatureTogglesService);
    service.start();
    for (let i = 0; i < 5; i++) {
      await Promise.resolve();
    }

    expect(service.toggles()).toEqual({ ...DEFAULTS, leaderboards: false });
  });
});
