import {
  BALANCE_VERSION,
  GPU_SELF_TEST_VERSION,
} from '@wolsok/feat-shared-bacteria-engine';
import type { GpuSelfTestResult } from './gpu-self-test';
import { webGlRenderer } from './renderer';

/*
 * The GPU self-test's result as a device keeps it between visits: what it
 * stores, when that still holds, and on which device it ran. Free of the
 * game's storage backends, so the game (`GpuSelfTestService`) and the
 * `/watch` page (`WatchGpu`) read and write it alike.
 */

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

/** The record that keeps `result` for `device`, tested at `now`. */
export function storedSelfTestOf(
  result: GpuSelfTestResult,
  device: SelfTestDevice,
  now: number
): StoredSelfTest {
  return {
    version: GPU_SELF_TEST_VERSION,
    balanceVersion: BALANCE_VERSION,
    renderer: device.renderer,
    browser: device.browser,
    ok: result.ok,
    ...(result.firstBadTick == null
      ? {}
      : { firstBadTick: result.firstBadTick }),
    testedAt: now,
  };
}

/** The verdict a stored record speaks. */
export function verdictOf(stored: StoredSelfTest): GpuSelfTestResult {
  return {
    ok: stored.ok,
    renderer: stored.renderer,
    ...(stored.firstBadTick == null
      ? {}
      : { firstBadTick: stored.firstBadTick }),
  };
}

/**
 * Whether a result may be kept: only one that ran to the end, on the GPU
 * it was asked for.
 */
export function keepsSelfTest(
  result: GpuSelfTestResult,
  device: SelfTestDevice
): boolean {
  return result.error == null && result.renderer === device.renderer;
}

/** Runs the task once the browser idles, or after the timeout. */
export function whenIdle(task: () => void): void {
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
export function thisDevice(arenaRenderer: string | null): SelfTestDevice {
  const browser = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  return { renderer: arenaRenderer ?? webGlRenderer() ?? 'none', browser };
}
