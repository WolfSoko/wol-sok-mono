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
  SELF_TEST_MAX_AGE_MS,
  SelfTestDevice,
  StoredSelfTest,
} from './gpu-self-test.service';

const NOW = 1_800_000_000_000;

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
    testedAt: NOW,
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
  const now = () => NOW;
  /** Runs a scheduled test at once - see `check`'s `schedule`. */
  const atOnce = (task: () => void) => task();
  const check = (service: GpuSelfTestService) =>
    service.check(run, () => DEVICE, atOnce, now);

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
    check(service);
    expect(service.result()).toBeNull();
    expect(runs).toBe(0);
  });

  it('runs the test once and remembers it for this device', () => {
    const service = setUp();
    check(service);
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
    check(service);
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
    check(service);
    storage.flush();
    expect(runs).toBe(1);
    expect(service.result()?.ok).toBe(false);
  });

  it('tests again once a stored result is a week old', () => {
    const service = setUp({
      [GPU_SELF_TEST_STORAGE_KEY]: stored({
        testedAt: NOW - SELF_TEST_MAX_AGE_MS,
      }),
    });
    check(service);
    storage.flush();
    expect(runs).toBe(1);
  });

  it('keeps a test that could not run to the end out of the storage', () => {
    const service = setUp();
    outcome = { ok: false, renderer: 'none', error: 'no WebGL2 context' };
    check(service);
    storage.flush();
    expect(service.result()).toEqual(outcome);
    storage.flush();
    expect(storage.stored(GPU_SELF_TEST_STORAGE_KEY)).toBeNull();
  });

  it('stores a result only for the GPU it ran on', () => {
    const service = setUp();
    outcome = { ok: true, renderer: 'Mali-G78' };
    check(service);
    storage.flush();
    storage.flush();
    expect(storage.stored(GPU_SELF_TEST_STORAGE_KEY)).toBeNull();
  });

  it('runs the test in a task of its own, not while the arena starts', () => {
    const service = setUp();
    const tasks: (() => void)[] = [];
    service.check(
      run,
      () => DEVICE,
      (task) => tasks.push(task),
      now
    );
    storage.flush();
    expect(runs).toBe(0);
    tasks.forEach((task) => task());
    expect(runs).toBe(1);
    expect(service.result()).toEqual(outcome);
  });

  it('asks only once per page session', () => {
    const service = setUp();
    check(service);
    check(service);
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
    const { testedAt: _testedAt, ...undated } = stored();
    expect(parseStoredSelfTest(undated)).toBeNull();
  });
});
