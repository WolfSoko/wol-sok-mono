import {
  createIntEffectUniforms,
  frameSeed,
  gameBalance,
  GridFrame,
} from '@wolsok/feat-shared-bacteria-engine';
import { Program } from './gl-utils';
import { GpuFloatRules, GpuIntRules, Programs } from './gpu-rules';

/** A uniform handed over: which pass, which uniform, which setter. */
interface Handed {
  pass: string;
  uniform: string;
  setter: string;
  value: unknown;
}

/**
 * A context that notes every uniform handed to it by pass and name - each
 * location stands for its name, each program for its pass.
 */
function recordingGl() {
  const handed: Handed[] = [];
  let pass = '';
  const gl = new Proxy(
    {},
    {
      get: (_target, name: string) =>
        name === 'useProgram'
          ? (program: string) => {
              pass = program;
            }
          : (uniform: string, value: unknown) => {
              handed.push({ pass, uniform, setter: name, value });
            },
    }
  ) as WebGL2RenderingContext;
  /** What a pass got for a uniform. */
  const value = (passName: string, uniform: string) =>
    handed.find((h) => h.pass === passName && h.uniform === uniform);
  return { gl, handed, value };
}

/** Programs whose program is their pass's name and each location its uniform's. */
function namedPrograms(): Programs {
  const uniforms = new Proxy({}, { get: (_target, name) => name });
  const program = (name: string): Program => ({
    program: name as unknown as WebGLProgram,
    uniforms: uniforms as Program['uniforms'],
  });
  return {
    influence: program('influence'),
    hunt: program('hunt'),
    claim: program('claim'),
    apply: program('apply'),
    crush: program('crush'),
    combat: program('combat'),
    feed: program('feed'),
    report: program('report'),
    effects: program('effects'),
  };
}

function frame(): GridFrame {
  return {
    deltaTimeSec: 1 / 30,
    uniforms: {
      steps: Int32Array.of(2, 1, 0, 0),
      targets: Float32Array.of(10, 12, 40, 8, NaN, NaN, NaN, NaN),
      aggression: Float32Array.of(0.5, 0.25, 0, 0),
      attack: Float32Array.of(1, 1.5, 0, 0),
      divideChance: Float32Array.of(0.1, 0.2, 0, 0),
      divideBudget: Float32Array.of(3, 4, 0, 0),
      pellets: Float32Array.of(20, 20, 1),
      toughness: Float32Array.of(1, 2, 0, 0),
      effects: new Float32Array(4),
      effectKinds: new Int32Array(2),
    },
    intEffects: createIntEffectUniforms(),
    pelletCount: 1,
    effectCount: 1,
  };
}

describe('GpuIntRules', () => {
  const rules = new GpuIntRules(gameBalance, 1234);

  it('is deterministic and seeds the draws of each step from the match’s seed', () => {
    expect(rules.deterministic).toBe(true);
    expect(rules.seed(7)).toBe(frameSeed(1234, 7));
    expect(rules.seed(8)).not.toBe(rules.seed(7));
  });

  it('hands the claim, apply and combat passes the frame in integers', () => {
    const { gl, value } = recordingGl();
    const f = frame();
    rules.uploadFrame(gl, namedPrograms(), f);
    for (const pass of ['claim', 'apply']) {
      expect(value(pass, 'uSteps[0]')).toMatchObject({
        setter: 'uniform1iv',
        value: f.uniforms.steps,
      });
      expect(value(pass, 'uTarget[0]')?.setter).toBe('uniform2iv');
      expect(value(pass, 'uAggression[0]')?.setter).toBe('uniform1iv');
      expect(value(pass, 'uDivideChance[0]')?.setter).toBe('uniform1uiv');
      // The integer passes work the budget out from the tick themselves.
      expect(value(pass, 'uDivideBudget[0]')).toBeUndefined();
    }
    expect(value('combat', 'uPellets[0]')?.setter).toBe('uniform3iv');
    expect(value('combat', 'uPelletCount')?.value).toBe(1);
    expect(value('combat', 'uAttack[0]')?.setter).toBe('uniform1iv');
    expect(value('combat', 'uDrain[0]')?.setter).toBe('uniform1iv');
    expect(value('combat', 'uDt')).toBeUndefined();
  });

  it('hands the passes the integer circles of the effects', () => {
    const { gl, handed } = recordingGl();
    const f = frame();
    rules.uploadEffects(gl, namedPrograms().claim.uniforms, f);
    expect(handed.map(({ uniform, value }) => [uniform, value])).toEqual([
      ['uEffects[0]', f.intEffects.circles],
      ['uEffectKinds[0]', f.intEffects.kinds],
    ]);
  });
});

describe('GpuFloatRules', () => {
  const rules = new GpuFloatRules(gameBalance);

  it('is not deterministic and seeds the draws of each step from the step alone', () => {
    expect(rules.deterministic).toBe(false);
    expect(rules.seed(7)).toBe((7 * 2654435761) >>> 0);
  });

  it('hands the claim, apply and combat passes the frame as it is', () => {
    const { gl, value } = recordingGl();
    const f = frame();
    rules.uploadFrame(gl, namedPrograms(), f);
    const u = f.uniforms;
    for (const pass of ['claim', 'apply']) {
      expect(value(pass, 'uSteps[0]')?.value).toBe(u.steps);
      expect(value(pass, 'uTarget[0]')?.value).toBe(u.targets);
      expect(value(pass, 'uAggression[0]')?.value).toBe(u.aggression);
      expect(value(pass, 'uDivideChance[0]')?.value).toBe(u.divideChance);
      expect(value(pass, 'uDivideBudget[0]')?.value).toBe(u.divideBudget);
    }
    expect(value('combat', 'uPellets[0]')?.value).toBe(u.pellets);
    expect(value('combat', 'uPelletCount')?.value).toBe(1);
    expect(value('combat', 'uDt')?.value).toBe(f.deltaTimeSec);
    expect(value('combat', 'uAttack[0]')?.value).toBe(u.attack);
    expect(value('combat', 'uToughness[0]')?.value).toBe(u.toughness);
    expect(value('combat', 'uNutrientGain')?.value).toBeCloseTo(
      gameBalance.nutrientDrainPerSec * f.deltaTimeSec
    );
  });

  it('hands the passes the float circles of the effects', () => {
    const { gl, handed } = recordingGl();
    const f = frame();
    rules.uploadEffects(gl, namedPrograms().claim.uniforms, f);
    expect(handed.map(({ uniform, value }) => [uniform, value])).toEqual([
      ['uEffects[0]', f.uniforms.effects],
      ['uEffectKinds[0]', f.uniforms.effectKinds],
    ]);
  });

  it('sets the balance into the passes’ match uniforms', () => {
    const set = jest.fn();
    rules.setMatchUniforms(namedPrograms(), set);
    const combat = set.mock.calls.find(
      ([program]) => program.program === 'combat'
    );
    expect(combat?.[1]).toMatchObject({
      uMaxEnergy: gameBalance.maxEnergy,
      uCombatDrain: gameBalance.combatDrainPerSec,
    });
  });
});
