import {
  BALANCE_VERSION,
  GPU_SELF_TEST_VERSION,
} from '@wolsok/feat-shared-bacteria-engine';
import type { KeyValueStorage } from '@wolsok/utils-browser-storage';
import type { GpuSelfTestResult } from '../gl/gpu-self-test';
import {
  GPU_SELF_TEST_STORAGE_KEY,
  SELF_TEST_MAX_AGE_MS,
  SelfTestDevice,
  StoredSelfTest,
} from '../gl/stored-self-test';
import { WatchGpu } from './watch-gpu';

const NOW = 1_800_000_000_000;
const DEVICE: SelfTestDevice = {
  renderer: 'Adreno 650',
  browser: 'Chrome 140',
};

class MemoryStorage implements KeyValueStorage {
  public readonly items = new Map<string, string>();
  public getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }
  public setItem(key: string, value: string): void {
    this.items.set(key, value);
  }
  public removeItem(key: string): void {
    this.items.delete(key);
  }
}

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

describe('WatchGpu', () => {
  let storage: MemoryStorage;
  let runs: number;
  let outcome: GpuSelfTestResult;
  let tasks: (() => void)[];
  let here: SelfTestDevice;

  function gpu(): WatchGpu {
    return new WatchGpu({
      storage: () => storage,
      device: () => here,
      run: () => {
        runs++;
        return outcome;
      },
      schedule: (task) => tasks.push(task),
      now: () => NOW,
    });
  }

  function idle(): void {
    while (tasks.length > 0) {
      tasks.shift()?.();
    }
  }

  function store(record: StoredSelfTest): void {
    storage.setItem(GPU_SELF_TEST_STORAGE_KEY, JSON.stringify(record));
  }

  beforeEach(() => {
    storage = new MemoryStorage();
    runs = 0;
    outcome = { ok: true, renderer: DEVICE.renderer };
    tasks = [];
    here = DEVICE;
  });

  it('trusts no GPU before it is started', () => {
    expect(gpu().trustedRenderer()).toBeNull();
  });

  it("takes the game's stored verdict for this device, without a test", () => {
    store(stored());
    const watch = gpu();
    watch.start();
    idle();
    expect(watch.trustedRenderer()).toBe(DEVICE.renderer);
    expect(runs).toBe(0);
  });

  it.each<[string, Partial<StoredSelfTest>]>([
    ['failed', { ok: false, firstBadTick: 4 }],
    ['ran on a software renderer', { renderer: 'SwiftShader' }],
  ])('trusts no GPU whose stored test %s', (_, overrides) => {
    here = { ...DEVICE, renderer: overrides.renderer ?? DEVICE.renderer };
    store(stored(overrides));
    const watch = gpu();
    watch.start();
    idle();
    expect(runs).toBe(0);
    expect(watch.trustedRenderer()).toBeNull();
  });

  it.each<[string, Partial<StoredSelfTest>]>([
    ['is a week old', { testedAt: NOW - SELF_TEST_MAX_AGE_MS }],
    ['is of another browser', { browser: 'Firefox 140' }],
    ['is of another test', { version: GPU_SELF_TEST_VERSION - 1 }],
    ['is of another balance', { balanceVersion: BALANCE_VERSION - 1 }],
  ])('tests again where the stored verdict %s', (_, overrides) => {
    store(stored(overrides));
    const watch = gpu();
    watch.start();
    idle();
    expect(runs).toBe(1);
    expect(watch.trustedRenderer()).toBe(DEVICE.renderer);
  });

  it('runs the test in an idle task and stores it as the game does', () => {
    const watch = gpu();
    watch.start();
    expect(runs).toBe(0);
    idle();
    expect(runs).toBe(1);
    expect(watch.trustedRenderer()).toBe(DEVICE.renderer);
    expect(
      JSON.parse(storage.getItem(GPU_SELF_TEST_STORAGE_KEY) ?? 'null')
    ).toEqual(stored());
  });

  it('trusts no GPU that fails the test, and stores that too', () => {
    outcome = { ok: false, renderer: DEVICE.renderer, firstBadTick: 2 };
    const watch = gpu();
    watch.start();
    idle();
    expect(watch.trustedRenderer()).toBeNull();
    expect(
      JSON.parse(storage.getItem(GPU_SELF_TEST_STORAGE_KEY) ?? 'null')
    ).toEqual(stored({ ok: false, firstBadTick: 2 }));
  });

  it('stores no test that broke off', () => {
    outcome = { ok: false, renderer: DEVICE.renderer, error: 'lost' };
    const watch = gpu();
    watch.start();
    idle();
    expect(storage.getItem(GPU_SELF_TEST_STORAGE_KEY)).toBeNull();
  });

  it('starts once', () => {
    const watch = gpu();
    watch.start();
    watch.start();
    idle();
    expect(runs).toBe(1);
  });

  it('runs the test where storage is withheld, keeping it for the visit', () => {
    const watch = new WatchGpu({
      storage: () => undefined,
      device: () => DEVICE,
      run: () => outcome,
      schedule: (task) => task(),
      now: () => NOW,
    });
    watch.start();
    expect(watch.trustedRenderer()).toBe(DEVICE.renderer);
  });
});
