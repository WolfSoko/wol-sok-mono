import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { provideGameToggles } from '../testing/fake-game-toggles';
import { FeatureTogglesService } from './feature-toggles.service';
import { FEATURE_TOGGLES, type FeatureToggles } from './state/feature-toggles';
import { GameCloud } from './storage/game-cloud';
import { GameToggles } from './storage/game-toggles';
import type { FirebaseConnection } from './storage/firebase-connection';

describe('FeatureTogglesService', () => {
  let set: Subject<Partial<FeatureToggles>>;

  function withToggles(): FeatureTogglesService {
    set = new Subject();
    TestBed.configureTestingModule({ providers: [provideGameToggles(set)] });
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

  it('asks the port only once started, and once however often started', () => {
    const watch = jest.fn(() => new Subject<Partial<FeatureToggles>>());
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

    expect(service.toggles()).toEqual(FEATURE_TOGGLES);
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
    service.start();
    for (let i = 0; i < 5; i++) {
      await Promise.resolve();
    }

    expect(service.toggles()).toEqual({
      ...FEATURE_TOGGLES,
      leaderboards: false,
    });
  });
});
