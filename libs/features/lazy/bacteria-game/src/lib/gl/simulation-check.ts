import type { TranslationKey } from '../i18n/dictionaries';
import type { TranslationParams } from '../i18n/translation';
import type { Ruleset } from '../state/simulation';
import type { GpuSelfTestResult } from './gpu-self-test';

/** One line of the settings' simulation check, a text to translate. */
export interface SimulationCheckLine {
  key: TranslationKey;
  params?: TranslationParams;
}

/**
 * A renderer that draws on the CPU: Chromium's SwiftShader, Mesa's llvmpipe
 * and softpipe, Windows' basic render driver. Such a "GPU" computes the
 * integer passes right, so it passes the self-test, but takes hundreds of
 * milliseconds a tick at the online grid, where the CPU's ruleset takes a
 * few.
 */
export function isSoftwareRenderer(renderer: string): boolean {
  return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(renderer);
}

/**
 * Whether this device's GPU plays the deterministic simulation (and offers
 * it online): it passed the self-test, on hardware.
 */
export function gpuTrusted(verdict: GpuSelfTestResult | null): boolean {
  return verdict?.ok === true && !isSoftwareRenderer(verdict.renderer);
}

/**
 * What the settings show about the deterministic simulation (ADR 0015) -
 * for the owner's real-device check, and for anybody who wonders why their
 * device plays where it does:
 * - which ruleset local matches play: the override's, or `gpu-int` where
 *   the GPU is trusted (`gpuTrusted`), `cpu` else;
 * - that an override (`?sim=`) set it, where one did;
 * - what the self-test found, and on which GPU.
 */
export function simulationCheckLines(
  verdict: GpuSelfTestResult | null,
  override: Ruleset | null
): SimulationCheckLine[] {
  const ruleset = override ?? (gpuTrusted(verdict) ? 'gpu-int' : 'cpu');
  const lines: SimulationCheckLine[] = [
    {
      key:
        ruleset === 'gpu-int'
          ? 'settings.simulation.gpuInt'
          : 'settings.simulation.cpu',
    },
  ];
  if (override !== null) {
    lines.push({
      key: 'settings.simulation.forced',
      params: { ruleset: override },
    });
  }
  lines.push(verdictLine(verdict));
  return lines;
}

function verdictLine(verdict: GpuSelfTestResult | null): SimulationCheckLine {
  if (verdict === null) {
    return { key: 'settings.simulation.pending' };
  }
  const renderer = verdict.renderer;
  if (verdict.ok) {
    return {
      key: isSoftwareRenderer(renderer)
        ? 'settings.simulation.software'
        : 'settings.simulation.passed',
      params: { renderer },
    };
  }
  if (verdict.error !== undefined) {
    return {
      key: 'settings.simulation.error',
      params: { renderer, error: verdict.error },
    };
  }
  return {
    key: 'settings.simulation.failedAt',
    params: { renderer, tick: verdict.firstBadTick ?? 1 },
  };
}
