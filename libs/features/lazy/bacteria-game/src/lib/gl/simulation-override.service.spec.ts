import { TestBed } from '@angular/core/testing';
import { LateGameStorage } from '../../testing/late-game-storage';
import { DeviceStorage } from '../storage/game-storage';
import {
  overrideFromQuery,
  parseSimulationOverride,
  SIMULATION_OVERRIDE_STORAGE_KEY,
  SimulationOverrideService,
} from './simulation-override.service';

describe('SimulationOverrideService', () => {
  let storage: LateGameStorage;

  function setUp(
    values: Record<string, unknown> = {}
  ): SimulationOverrideService {
    storage = new LateGameStorage(values);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: DeviceStorage, useValue: storage }],
    });
    return TestBed.inject(SimulationOverrideService);
  }

  it('follows the self-test until something says otherwise', () => {
    const service = setUp();
    service.start('');
    storage.flush();
    expect(service.override()).toBeNull();
  });

  it('takes the stored override once the storage answers', () => {
    const service = setUp({ [SIMULATION_OVERRIDE_STORAGE_KEY]: 'gpu-int' });
    service.start('');
    expect(service.override()).toBeNull();
    storage.flush();
    expect(service.override()).toBe('gpu-int');
  });

  it('takes the one the URL asks for and remembers it for the device', () => {
    const service = setUp({ [SIMULATION_OVERRIDE_STORAGE_KEY]: 'cpu' });
    service.start('?sim=gpu-int');
    expect(service.override()).toBe('gpu-int');
    storage.flush();
    expect(storage.stored(SIMULATION_OVERRIDE_STORAGE_KEY)).toBe('gpu-int');
    expect(service.override()).toBe('gpu-int');
  });

  it("keeps the player's choice, over a stored one that answers late", () => {
    const service = setUp({ [SIMULATION_OVERRIDE_STORAGE_KEY]: 'gpu-int' });
    service.start('');
    service.choose('cpu');
    storage.flush();
    expect(service.override()).toBe('cpu');
    expect(storage.stored(SIMULATION_OVERRIDE_STORAGE_KEY)).toBe('cpu');

    service.choose(null);
    storage.flush();
    expect(service.override()).toBeNull();
    expect(storage.stored(SIMULATION_OVERRIDE_STORAGE_KEY)).toBeNull();
  });

  it('goes back to the self-test for ?sim=auto', () => {
    const service = setUp({ [SIMULATION_OVERRIDE_STORAGE_KEY]: 'cpu' });
    service.start('?level=1&sim=auto');
    storage.flush();
    expect(service.override()).toBeNull();
    expect(storage.stored(SIMULATION_OVERRIDE_STORAGE_KEY)).toBeNull();
  });
});

describe('overrideFromQuery', () => {
  it('reads a ruleset, auto or nothing', () => {
    expect(overrideFromQuery('?sim=cpu')).toBe('cpu');
    expect(overrideFromQuery('?sim=gpu-int')).toBe('gpu-int');
    expect(overrideFromQuery('?sim=auto')).toBeNull();
    expect(overrideFromQuery('?sim=gpu')).toBeUndefined();
    expect(overrideFromQuery('')).toBeUndefined();
  });
});

describe('parseSimulationOverride', () => {
  it('keeps a ruleset and drops anything else', () => {
    expect(parseSimulationOverride('gpu-int')).toBe('gpu-int');
    expect(parseSimulationOverride('gpu')).toBeNull();
    expect(parseSimulationOverride(null)).toBeNull();
  });
});
