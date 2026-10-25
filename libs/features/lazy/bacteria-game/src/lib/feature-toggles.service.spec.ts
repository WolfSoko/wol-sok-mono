import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { FeatureTogglesService } from './feature-toggles.service';
import { FEATURE_TOGGLES, type FeatureToggles } from './state/feature-toggles';
import { GameCloud } from './storage/game-cloud';
import { GameToggles } from './storage/game-toggles';
import { RemoteConfigGameToggles } from './storage/remote-config-game-toggles';
import type { FirebaseConnection } from './storage/firebase-connection';

describe('FeatureTogglesService', () => {
  let set: Subject<Partial<FeatureToggles>>;

  function withToggles(): FeatureTogglesService {
    set = new Subject();
    TestBed.configureTestingModule({
      providers: [{ provide: GameToggles, useValue: { watch: () => set } }],
    });
    return TestBed.inject(FeatureTogglesService);
  }

  beforeEach(() => TestBed.resetTestingModule());

  it('starts at the defaults, before Remote Config answers', () => {
    expect(withToggles().toggles()).toEqual(FEATURE_TOGGLES);
  });

  it('takes what the owner set, the defaults for the rest', () => {
    const service = withToggles();

    set.next({ matchmaking: false, deterministicSimulation: false });

    expect(service.toggles()).toEqual({
      ...FEATURE_TOGGLES,
      matchmaking: false,
      deterministicSimulation: false,
    });
  });

  it('keeps the same value while nothing changes', () => {
    const service = withToggles();
    const before = service.toggles();

    set.next({});

    expect(service.toggles()).toBe(before);
  });

  it('keeps the defaults when the toggles fail', () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const service = withToggles();

    set.error(new Error('offline'));

    expect(service.toggles()).toEqual(FEATURE_TOGGLES);
  });

  it('keeps the defaults when the fetch fails', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    TestBed.configureTestingModule({
      providers: [
        {
          provide: GameToggles,
          useValue: new RemoteConfigGameToggles(() =>
            Promise.reject(new Error('fetch failed'))
          ),
        },
      ],
    });
    const service = TestBed.inject(FeatureTogglesService);
    await Promise.resolve();
    await Promise.resolve();

    expect(service.toggles()).toEqual(FEATURE_TOGGLES);
  });

  it('has the defaults without a project', () => {
    expect(TestBed.inject(FeatureTogglesService).toggles()).toEqual(
      FEATURE_TOGGLES
    );
  });

  it("has what the project's Remote Config says", async () => {
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
    for (let i = 0; i < 5; i++) {
      await Promise.resolve();
    }

    expect(service.toggles()).toEqual({
      ...FEATURE_TOGGLES,
      leaderboards: false,
    });
  });
});
