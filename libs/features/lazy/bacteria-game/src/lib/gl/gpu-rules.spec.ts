import {
  createIntEffectUniforms,
  DETERMINISTIC_REPORT_LAG,
  frameSeed,
  gameBalance,
  GridFrame,
} from '@wolsok/feat-shared-bacteria-engine';
import { GpuFloatRules, GpuIntRules } from './gpu-rules';

/** A context that only notes the uniforms handed to it, by setter. */
function recordingGl() {
  const calls: { name: string; value: unknown }[] = [];
  const record =
    (name: string) =>
    (_at: unknown, value: unknown): void => {
      calls.push({ name, value });
    };
  const gl = {
    uniform4iv: record('uniform4iv'),
    uniform2iv: record('uniform2iv'),
    uniform4fv: record('uniform4fv'),
  } as unknown as WebGL2RenderingContext;
  return { gl, calls };
}

function frame(): GridFrame {
  return {
    deltaTimeSec: 1 / 30,
    uniforms: {
      steps: new Int32Array(4),
      targets: new Float32Array(8),
      aggression: new Float32Array(4),
      attack: new Float32Array(4),
      divideChance: new Float32Array(4),
      divideBudget: new Float32Array(4),
      pellets: new Float32Array(3),
      toughness: new Float32Array(4),
      effects: new Float32Array(4),
      effectKinds: new Int32Array(2),
    },
    intEffects: createIntEffectUniforms(),
    pelletCount: 0,
    effectCount: 1,
  };
}

describe('GpuIntRules', () => {
  const rules = new GpuIntRules(gameBalance, 1234);

  it('takes every report exactly DETERMINISTIC_REPORT_LAG ticks late', () => {
    expect(rules.deterministic).toBe(true);
    expect(rules.reportLag).toBe(DETERMINISTIC_REPORT_LAG);
  });

  it('seeds the draws of each step from the match’s seed', () => {
    expect(rules.seed(7)).toBe(frameSeed(1234, 7));
  });

  it('hands the passes the integer circles of the effects', () => {
    const { gl, calls } = recordingGl();
    const f = frame();
    rules.uploadEffects(gl, {}, f);
    expect(calls).toEqual([
      { name: 'uniform4iv', value: f.intEffects.circles },
      { name: 'uniform2iv', value: f.intEffects.kinds },
    ]);
  });
});

describe('GpuFloatRules', () => {
  const rules = new GpuFloatRules(gameBalance);

  it('takes the reports as the GPU finishes them', () => {
    expect(rules.deterministic).toBe(false);
    expect(rules.reportLag).toBeNull();
  });

  it('seeds the draws of each step from the step alone', () => {
    expect(rules.seed(7)).toBe((7 * 2654435761) >>> 0);
  });

  it('hands the passes the float circles of the effects', () => {
    const { gl, calls } = recordingGl();
    const f = frame();
    rules.uploadEffects(gl, {}, f);
    expect(calls).toEqual([
      { name: 'uniform4fv', value: f.uniforms.effects },
      { name: 'uniform2iv', value: f.uniforms.effectKinds },
    ]);
  });
});
