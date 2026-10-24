import { TestBed } from '@angular/core/testing';
import { BALANCE_VERSION } from '../state/game-balance';
import { GPU_SELF_TEST_VERSION } from '../state/gpu-int/self-test-golden';
import { DeviceStorage } from '../storage/game-storage';
import { LateGameStorage } from '../../testing/late-game-storage';
import { GpuSelfTestResult } from './gpu-self-test';
import {
  GPU_SELF_TEST_STORAGE_KEY,
  GpuSelfTestService,
  parseStoredSelfTest,
  SelfTestDevice,
  StoredSelfTest,
} from './gpu-self-test.service';

const DEVICE: SelfTestDevice = {
  renderer: 'Adreno 650',
  browser: 'Chrome 140',
};

function stored(overrides: Partial<StoredSelfTest> = {}): StoredSelfTest {
  return {
    version: GPU_SELF_TEST_VERSION,
    balanceVersion: BALANCE_VERSION,
    ...DEVICE,
    ok: true,
    ...overrides,
  };
}

describe('GpuSelfTestService', () => {
  let storage: LateGameStorage;
  let runs: number;
  let outcome: GpuSelfTestResult;
  const run = () => {
    runs++;
    return outcome;
  };

  function setUp(values: Record<string, unknown> = {}): GpuSelfTestService {
    storage = new LateGameStorage(values);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: DeviceStorage, useValue: storage }],
    });
    return TestBed.inject(GpuSelfTestService);
  }

  beforeEach(() => {
    runs = 0;
    outcome = { ok: true, renderer: DEVICE.renderer };
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  it('has no verdict until the storage answers', () => {
    const service = setUp();
    service.check(run, () => DEVICE);
    expect(service.result()).toBeNull();
    expect(runs).toBe(0);
  });

  it('runs the test once and remembers it for this device', () => {
    const service = setUp();
    service.check(run, () => DEVICE);
    storage.flush();
    expect(runs).toBe(1);
    expect(service.result()).toEqual(outcome);
    storage.flush();
    expect(storage.stored(GPU_SELF_TEST_STORAGE_KEY)).toEqual(stored());
  });

  it('takes a stored result for the same GPU, browser and test', () => {
    const service = setUp({
      [GPU_SELF_TEST_STORAGE_KEY]: stored({ ok: false, firstBadTick: 4 }),
    });
    service.check(run, () => DEVICE);
    storage.flush();
    expect(runs).toBe(0);
    expect(service.result()).toEqual({
      ok: false,
      firstBadTick: 4,
      renderer: DEVICE.renderer,
    });
  });

  it.each([
    ['another GPU', { renderer: 'Mali-G78' }],
    ['another browser', { browser: 'Chrome 141' }],
    ['another test', { version: GPU_SELF_TEST_VERSION - 1 }],
    ['another balance', { balanceVersion: BALANCE_VERSION - 1 }],
  ])('tests again for %s', (_, change) => {
    const service = setUp({ [GPU_SELF_TEST_STORAGE_KEY]: stored(change) });
    outcome = { ok: false, firstBadTick: 2, renderer: DEVICE.renderer };
    service.check(run, () => DEVICE);
    storage.flush();
    expect(runs).toBe(1);
    expect(service.result()?.ok).toBe(false);
  });

  it('asks only once per page session', () => {
    const service = setUp();
    service.check(run, () => DEVICE);
    service.check(run, () => DEVICE);
    storage.flush();
    expect(runs).toBe(1);
  });
});

describe('parseStoredSelfTest', () => {
  it('reads what it stored', () => {
    expect(parseStoredSelfTest(stored({ firstBadTick: 3 }))).toEqual(
      stored({ firstBadTick: 3 })
    );
  });

  it('drops what it cannot read', () => {
    expect(parseStoredSelfTest(null)).toBeNull();
    expect(parseStoredSelfTest('ok')).toBeNull();
    expect(parseStoredSelfTest({ ...stored(), ok: 'yes' })).toBeNull();
  });
});
