import { inject, Injectable, signal } from '@angular/core';
import { take } from 'rxjs';
import { BALANCE_VERSION } from '../state/game-balance';
import { GPU_SELF_TEST_VERSION } from '../state/gpu-int/self-test-golden';
import { DeviceStorage } from '../storage/game-storage';
import { GpuSelfTestResult, runGpuSelfTest } from './gpu-self-test';
import { rendererOf } from './renderer';

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
  /** When it ran, in ms since the epoch - see {@link SELF_TEST_MAX_AGE_MS}. */
  testedAt: number;
}

/**
 * How long a stored result holds. Neither the renderer string nor the
 * browser's names the driver's version on most devices, so a driver update
 * goes unseen: testing again every week bounds how long a device plays on
 * a verdict its new driver no longer earns.
 */
export const SELF_TEST_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

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
    typeof v['ok'] !== 'boolean' ||
    typeof v['testedAt'] !== 'number'
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
    testedAt: v['testedAt'],
  };
}

/**
 * True when a stored result still speaks for this device: the same test,
 * balance, GPU and browser, and younger than {@link SELF_TEST_MAX_AGE_MS}.
 */
export function storedResultHolds(
  stored: StoredSelfTest,
  device: SelfTestDevice,
  now: number
): boolean {
  return (
    stored.version === GPU_SELF_TEST_VERSION &&
    stored.balanceVersion === BALANCE_VERSION &&
    stored.renderer === device.renderer &&
    stored.browser === device.browser &&
    now - stored.testedAt >= 0 &&
    now - stored.testedAt < SELF_TEST_MAX_AGE_MS
  );
}

/** How long the check waits for the browser to idle, at most. */
export const SELF_TEST_IDLE_TIMEOUT_MS = 2_000;

/**
 * Whether this device's GPU computes the deterministic simulation as every
 * other device does (ADR 0015, step 7) - see `runGpuSelfTest`. It is asked
 * once per page session and remembered per device in `DeviceStorage`, so
 * the test only runs again for another GPU, browser, balance or test.
 *
 * The answer comes late, off the game's start: the check waits for the
 * browser to idle, and so does the test where it has to run. Until then
 * `result` is null and a deterministic match plays on the CPU. The GPU's
 * name comes from the arena's context once the arena told it
 * (`sawRenderer`), else from a throwaway one. A test that could not run to
 * the end (`error`) fails for this page session only and is not stored.
 */
@Injectable({ providedIn: 'root' })
export class GpuSelfTestService {
  private readonly storage = inject(DeviceStorage);
  private readonly verdict = signal<GpuSelfTestResult | null>(null);
  private started = false;
  /** The GPU the arena's WebGL2 context renders with, once it said. */
  private arenaRenderer: string | null = null;

  /** The verdict, null until there is one. */
  public readonly result = this.verdict.asReadonly();

  /**
   * Tells the GPU the arena's WebGL2 context renders with, so the check
   * needs no context of its own to learn it.
   */
  public sawRenderer(renderer: string): void {
    this.arenaRenderer = renderer;
  }

  /**
   * Starts finding out, once per page session: from what this device
   * stored, or by running the test. The arguments are for specs.
   */
  public check(
    run: () => GpuSelfTestResult = runGpuSelfTest,
    device: () => SelfTestDevice = () => thisDevice(this.arenaRenderer),
    schedule: (task: () => void) => void = whenIdle,
    now: () => number = Date.now
  ): void {
    if (this.started) {
      return;
    }
    this.started = true;
    schedule(() => this.lookUp(run, device(), schedule, now));
  }

  /** Takes what this device stored for it, or runs the test. */
  private lookUp(
    run: () => GpuSelfTestResult,
    here: SelfTestDevice,
    schedule: (task: () => void) => void,
    now: () => number
  ): void {
    this.storage
      .watch(GPU_SELF_TEST_STORAGE_KEY)
      .pipe(take(1))
      .subscribe((value) => {
        const stored = parseStoredSelfTest(value);
        if (stored != null && storedResultHolds(stored, here, now())) {
          this.verdict.set({
            ok: stored.ok,
            renderer: stored.renderer,
            ...(stored.firstBadTick == null
              ? {}
              : { firstBadTick: stored.firstBadTick }),
          });
          return;
        }
        schedule(() => this.runAndStore(run, here, now));
      });
  }

  private runAndStore(
    run: () => GpuSelfTestResult,
    here: SelfTestDevice,
    now: () => number
  ): void {
    const result = run();
    if (!result.ok) {
      console.warn(
        'The GPU fails the deterministic self-test - matches play on the CPU',
        result
      );
    }
    this.verdict.set(result);
    // Kept only for the GPU it ran on, and only when it ran to the end.
    if (result.error != null || result.renderer !== here.renderer) {
      return;
    }
    const record: StoredSelfTest = {
      version: GPU_SELF_TEST_VERSION,
      balanceVersion: BALANCE_VERSION,
      renderer: here.renderer,
      browser: here.browser,
      ok: result.ok,
      ...(result.firstBadTick == null
        ? {}
        : { firstBadTick: result.firstBadTick }),
      testedAt: now(),
    };
    this.storage.write(GPU_SELF_TEST_STORAGE_KEY, record);
  }
}

/** Runs the task once the browser idles, or after the timeout. */
function whenIdle(task: () => void): void {
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(() => task(), { timeout: SELF_TEST_IDLE_TIMEOUT_MS });
  } else {
    setTimeout(task);
  }
}

/**
 * This device's GPU and its browser: the arena's GPU when it is known, else
 * the one a throwaway context renders with.
 */
function thisDevice(arenaRenderer: string | null): SelfTestDevice {
  const browser = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  if (arenaRenderer != null) {
    return { renderer: arenaRenderer, browser };
  }
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
