import { Injectable, signal } from '@angular/core';
import {
  deviceStorage,
  type KeyValueStorage,
  readStoredJson,
  writeStoredJson,
} from '@wolsok/utils-browser-storage';
import { type GpuSelfTestResult, runGpuSelfTest } from '../gl/gpu-self-test';
import { gpuTrusted } from '../gl/simulation-check';
import {
  GPU_SELF_TEST_STORAGE_KEY,
  keepsSelfTest,
  parseStoredSelfTest,
  type SelfTestDevice,
  storedResultHolds,
  storedSelfTestOf,
  thisDevice,
  verdictOf,
  whenIdle,
} from '../gl/stored-self-test';

/** What `WatchGpu` reaches the device through - specs pass their own. */
export interface WatchGpuDevice {
  storage: () => KeyValueStorage | undefined;
  device: () => SelfTestDevice;
  run: () => GpuSelfTestResult;
  schedule: (task: () => void) => void;
  now: () => number;
}

const BROWSER: WatchGpuDevice = {
  storage: deviceStorage,
  device: () => thisDevice(null),
  run: runGpuSelfTest,
  schedule: whenIdle,
  now: Date.now,
};

/**
 * Which GPU the `/watch` page trusts with a `gpu-int` replay (#3059): the
 * one the game's GPU self-test passed on this device, as the game stored it
 * (`GPU_SELF_TEST_STORAGE_KEY`), or - where no stored verdict holds - the
 * test run here once the browser idles, and stored for the game the same
 * way. The page loads none of the game's storage backends or analytics, so
 * it reads and writes the device's local storage directly.
 */
@Injectable({ providedIn: 'root', useFactory: () => new WatchGpu() })
export class WatchGpu {
  private readonly verdict = signal<GpuSelfTestResult | null>(null);
  private started = false;

  /** The renderer of the trusted GPU, null while none is (yet). */
  public readonly trustedRenderer = (): string | null => {
    const verdict = this.verdict();
    return gpuTrusted(verdict) ? (verdict?.renderer ?? null) : null;
  };

  public constructor(private readonly on: WatchGpuDevice = BROWSER) {}

  /** Starts finding out, once: off the page's start, in idle tasks. */
  public start(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    this.on.schedule(() => this.lookUp());
  }

  private lookUp(): void {
    const here = this.on.device();
    const stored = parseStoredSelfTest(
      readStoredJson(GPU_SELF_TEST_STORAGE_KEY, this.on.storage())
    );
    if (stored !== null && storedResultHolds(stored, here, this.on.now())) {
      this.verdict.set(verdictOf(stored));
      return;
    }
    this.on.schedule(() => this.runAndStore(here));
  }

  private runAndStore(here: SelfTestDevice): void {
    const result = this.on.run();
    this.verdict.set(result);
    if (keepsSelfTest(result, here)) {
      writeStoredJson(
        GPU_SELF_TEST_STORAGE_KEY,
        storedSelfTestOf(result, here, this.on.now()),
        this.on.storage()
      );
    }
  }
}
