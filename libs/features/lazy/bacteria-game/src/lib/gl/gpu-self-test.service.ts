import { inject, Injectable, signal } from '@angular/core';
import { take } from 'rxjs';
import { BALANCE_VERSION } from '../state/game-balance';
import { GPU_SELF_TEST_VERSION } from '../state/gpu-int/self-test-golden';
import { DeviceStorage } from '../storage/game-storage';
import { GpuSelfTestResult, rendererOf, runGpuSelfTest } from './gpu-self-test';

/** Where this device keeps the self-test's last result. */
export const GPU_SELF_TEST_STORAGE_KEY = 'bacteria-game.gpu-self-test';

/** The device a stored result belongs to: its GPU and its browser. */
export interface SelfTestDevice {
  renderer: string;
  browser: string;
}

/** A stored self-test result, and what it was run on. */
export interface StoredSelfTest extends SelfTestDevice {
  version: number;
  balanceVersion: number;
  ok: boolean;
  firstBadTick?: number;
}

/** A stored result, as far as it can be read - null when it cannot. */
export function parseStoredSelfTest(value: unknown): StoredSelfTest | null {
  if (typeof value !== 'object' || value == null) {
    return null;
  }
  const v = value as Record<string, unknown>;
  if (
    typeof v['version'] !== 'number' ||
    typeof v['balanceVersion'] !== 'number' ||
    typeof v['renderer'] !== 'string' ||
    typeof v['browser'] !== 'string' ||
    typeof v['ok'] !== 'boolean'
  ) {
    return null;
  }
  const tick = v['firstBadTick'];
  return {
    version: v['version'],
    balanceVersion: v['balanceVersion'],
    renderer: v['renderer'],
    browser: v['browser'],
    ok: v['ok'],
    ...(typeof tick === 'number' ? { firstBadTick: tick } : {}),
  };
}

/**
 * True when a stored result still speaks for this device: the same test,
 * balance, GPU and browser - a browser or driver update tests again.
 */
export function storedResultHolds(
  stored: StoredSelfTest,
  device: SelfTestDevice
): boolean {
  return (
    stored.version === GPU_SELF_TEST_VERSION &&
    stored.balanceVersion === BALANCE_VERSION &&
    stored.renderer === device.renderer &&
    stored.browser === device.browser
  );
}

/**
 * Whether this device's GPU computes the deterministic simulation as every
 * other device does (ADR 0015, step 7) - see `runGpuSelfTest`. It is asked
 * once per page session and remembered per device in `DeviceStorage`, so
 * the test only runs again for another GPU, browser, balance or test.
 *
 * The answer comes late: until it does, `result` is null and a
 * deterministic match plays on the CPU.
 */
@Injectable({ providedIn: 'root' })
export class GpuSelfTestService {
  private readonly storage = inject(DeviceStorage);
  private readonly verdict = signal<GpuSelfTestResult | null>(null);
  private started = false;

  /** The verdict, null until there is one. */
  public readonly result = this.verdict.asReadonly();

  /**
   * Starts finding out, once per page session: from what this device
   * stored, or by running the test. The arguments are for specs.
   */
  public check(
    run: () => GpuSelfTestResult = runGpuSelfTest,
    device: () => SelfTestDevice = thisDevice
  ): void {
    if (this.started) {
      return;
    }
    this.started = true;
    const here = device();
    this.storage
      .watch(GPU_SELF_TEST_STORAGE_KEY)
      .pipe(take(1))
      .subscribe((value) => {
        const stored = parseStoredSelfTest(value);
        if (stored != null && storedResultHolds(stored, here)) {
          this.verdict.set({
            ok: stored.ok,
            renderer: stored.renderer,
            ...(stored.firstBadTick == null
              ? {}
              : { firstBadTick: stored.firstBadTick }),
          });
          return;
        }
        const result = run();
        if (!result.ok) {
          console.warn(
            'The GPU fails the deterministic self-test - matches play on the CPU',
            result
          );
        }
        this.verdict.set(result);
        const record: StoredSelfTest = {
          version: GPU_SELF_TEST_VERSION,
          balanceVersion: BALANCE_VERSION,
          renderer: here.renderer,
          browser: here.browser,
          ok: result.ok,
          ...(result.firstBadTick == null
            ? {}
            : { firstBadTick: result.firstBadTick }),
        };
        this.storage.write(GPU_SELF_TEST_STORAGE_KEY, record);
      });
  }
}

/** This device's GPU, from a throwaway context, and its browser. */
function thisDevice(): SelfTestDevice {
  const browser = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  const gl = document.createElement('canvas').getContext('webgl2');
  if (gl == null) {
    return { renderer: 'none', browser };
  }
  try {
    return { renderer: rendererOf(gl), browser };
  } finally {
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
