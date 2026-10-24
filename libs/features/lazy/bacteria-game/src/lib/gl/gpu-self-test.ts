import {
  playScenario,
  scenarioRandom,
  SELF_TEST_SCENARIO,
  selfTestVerdict,
  SelfTestVerdict,
} from '../state/gpu-int/sim-scenarios';
import { SELF_TEST_GOLDEN } from '../state/gpu-int/self-test-golden';
import { GpuSimulation } from './gpu-simulation';

/** What the self-test found on this device's GPU. */
export interface GpuSelfTestResult extends SelfTestVerdict {
  /** The GPU and driver, as WebGL names them - `none` without WebGL2. */
  renderer: string;
  /**
   * Why the test could not run to the end - no WebGL2 context, a shader the
   * driver rejected, a lost context. Absent when it compared every tick.
   */
  error?: string;
}

/**
 * Plays `SELF_TEST_SCENARIO` through a deterministic `GpuSimulation` on
 * this context and compares every tick with the TypeScript reference's
 * hashes (`SELF_TEST_GOLDEN`, ADR 0015 step 7). A GPU passes only when all
 * of them agree: then it computes the deterministic simulation as every
 * other device does, and may play a deterministic match. Any error - a
 * shader the driver rejects, a format it cannot render into - fails it.
 *
 * It compiles the integer programs and waits for the GPU once per tick; run it on a context of its own, as the programs' uniforms are
 * shared by every simulation on one.
 */
export function gpuSelfTest(gl: WebGL2RenderingContext): GpuSelfTestResult {
  const renderer = rendererOf(gl);
  const scenario = SELF_TEST_SCENARIO;
  let simulation: GpuSimulation | null = null;
  try {
    simulation = new GpuSimulation(
      gl,
      scenario.balance,
      scenarioRandom(scenario),
      { deterministic: true, matchSeed: scenario.matchSeed }
    );
    const hashes = playScenario(scenario, simulation);
    return { ...selfTestVerdict(hashes, SELF_TEST_GOLDEN.hashes), renderer };
  } catch (error) {
    return { ok: false, renderer, error: String(error) };
  } finally {
    simulation?.dispose();
  }
}

/**
 * The self-test on a fresh WebGL2 context, which it hands back to the
 * browser right after - fails without WebGL2.
 */
export function runGpuSelfTest(
  createContext: () => WebGL2RenderingContext | null = freshContext
): GpuSelfTestResult {
  let gl: WebGL2RenderingContext | null = null;
  try {
    gl = createContext();
  } catch {
    gl = null;
  }
  if (gl == null) {
    return { ok: false, renderer: 'none', error: 'no WebGL2 context' };
  }
  try {
    return gpuSelfTest(gl);
  } finally {
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}

/** The GPU and driver a context renders with. */
export function rendererOf(gl: WebGL2RenderingContext): string {
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const name: unknown = gl.getParameter(
    info == null ? gl.RENDERER : info.UNMASKED_RENDERER_WEBGL
  );
  return typeof name === 'string' ? name : 'unknown';
}

function freshContext(): WebGL2RenderingContext | null {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  return canvas.getContext('webgl2');
}
