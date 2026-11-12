import { computed, inject, Injectable, signal } from '@angular/core';
import { take } from 'rxjs';
import { injectGameAnalytics } from '../analytics/game-analytics';
import { DeviceStorage } from '../storage/game-storage';
import { GpuSelfTestResult, runGpuSelfTest } from './gpu-self-test';
import { gpuTrusted } from './simulation-check';
import {
  GPU_SELF_TEST_STORAGE_KEY,
  keepsSelfTest,
  parseStoredSelfTest,
  SelfTestDevice,
  storedResultHolds,
  storedSelfTestOf,
  thisDevice,
  verdictOf,
  whenIdle,
} from './stored-self-test';

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
  private readonly analytics = injectGameAnalytics();
  private readonly verdict = signal<GpuSelfTestResult | null>(null);
  private started = false;
  /** The GPU the arena's WebGL2 context renders with, once it said. */
  private readonly arenaRenderer = signal<string | null>(null);

  /**
   * The verdict, null until there is one - and null while it speaks for
   * another GPU than the arena's (a context on another GPU, or the arena
   * moved to one), since only the GPU it ran on earned it.
   */
  public readonly result = computed(() => {
    const verdict = this.verdict();
    const arena = this.arenaRenderer();
    return verdict != null && arena != null && verdict.renderer !== arena
      ? null
      : verdict;
  });

  /**
   * The renderer of a GPU trusted with the integer passes (`gpuTrusted`),
   * null while none is: a replay of them plays on that GPU.
   */
  public readonly trustedRenderer = computed(() => {
    const verdict = this.result();
    return verdict !== null && gpuTrusted(verdict) ? verdict.renderer : null;
  });

  /**
   * Tells the GPU the arena's WebGL2 context renders with, so the check
   * needs no context of its own to learn it.
   */
  public sawRenderer(renderer: string): void {
    this.arenaRenderer.set(renderer);
  }

  /**
   * Starts finding out, once per page session: from what this device
   * stored, or by running the test. The arguments are for specs.
   */
  public check(
    run: () => GpuSelfTestResult = runGpuSelfTest,
    device: () => SelfTestDevice = () => thisDevice(this.arenaRenderer()),
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
          this.verdict.set(verdictOf(stored));
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
    this.analytics.track('gpu_self_test', {
      passed: result.ok,
      ran_through: result.error == null,
    });
    if (!result.ok) {
      console.warn(
        'The GPU fails the deterministic self-test - matches play on the CPU',
        result
      );
    }
    this.verdict.set(result);
    if (keepsSelfTest(result, here)) {
      this.storage.write(
        GPU_SELF_TEST_STORAGE_KEY,
        storedSelfTestOf(result, here, now())
      );
    }
  }
}
