import { TestBed } from '@angular/core/testing';
import {
  FEATURE_TOGGLES,
  GameCloud,
} from '@wolsok/feat-lazy-bac-game/admin-kit';
import { AdminTogglesService } from './admin-toggles.service';

/** Remote Config holding `matchmaking: false`, the rest unset (static). */
function remoteConfig() {
  const settings = { minimumFetchIntervalMillis: 3_600_000 };
  const intervals: number[] = [];
  const sdk = {
    fetchAndActivate: jest.fn(async () => {
      intervals.push(settings.minimumFetchIntervalMillis);
      return true;
    }),
    getValue: (_config: unknown, key: string) => ({
      asString: () => (key === 'matchmaking' ? 'false' : ''),
      getSource: () => (key === 'matchmaking' ? 'remote' : 'static'),
    }),
  };
  return { rc: { config: { settings }, sdk }, settings, intervals };
}

function setUp(rc: unknown) {
  TestBed.configureTestingModule({
    providers: [
      {
        provide: GameCloud,
        useValue: { firebase: () => ({ remoteConfig: async () => rc }) },
      },
    ],
  });
  return TestBed.inject(AdminTogglesService);
}

describe('AdminTogglesService', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('reads what Remote Config holds over the defaults', async () => {
    const { rc } = remoteConfig();
    const state = await setUp(rc).read(false);
    expect(state).toEqual({
      available: true,
      values: { ...FEATURE_TOGGLES, matchmaking: false },
      set: { matchmaking: false },
    });
    expect(rc.sdk.fetchAndActivate).not.toHaveBeenCalled();
  });

  it("fetches past the game's hour once for a fresh read", async () => {
    const { rc, settings, intervals } = remoteConfig();
    await setUp(rc).read(true);
    expect(intervals).toEqual([0]);
    expect(settings.minimumFetchIntervalMillis).toBe(3_600_000);
  });

  it('shows the defaults where Remote Config cannot be reached', async () => {
    expect(await setUp(null).read(true)).toEqual({
      available: false,
      values: FEATURE_TOGGLES,
      set: {},
    });
  });
});
