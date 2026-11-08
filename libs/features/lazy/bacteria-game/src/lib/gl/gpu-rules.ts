import {
  createIntFrameUniforms,
  DETERMINISTIC_REPORT_LAG,
  fillIntCombatUniforms,
  fillIntFrameUniforms,
  frameSeed,
  GameBalance,
  GridFrame,
  intMatchUniforms,
} from '@wolsok/feat-shared-bacteria-engine';
import { createProgram, FULLSCREEN_VERTEX, Program } from './gl-utils';
import {
  APPLY_FRAGMENT,
  CLAIM_FRAGMENT,
  COMBAT_FRAGMENT,
  CRUSH_FRAGMENT,
  EFFECTS_FRAGMENT,
  FEED_FRAGMENT,
  HUNT_FRAGMENT,
  INFLUENCE_FRAGMENT,
  REPORT_FRAGMENT,
} from './simulation-shaders';
import {
  INT_APPLY_FRAGMENT,
  INT_CLAIM_FRAGMENT,
  INT_COMBAT_FRAGMENT,
  INT_FEED_FRAGMENT,
  INT_HUNT_FRAGMENT,
} from './int-simulation-shaders';

/** Every pass a tick of the GPU war runs. */
export interface Programs {
  influence: Program;
  hunt: Program;
  claim: Program;
  apply: Program;
  crush: Program;
  combat: Program;
  feed: Program;
  report: Program;
  effects: Program;
}

/** The cell passes, which each kind of rules compiles its own of. */
export type CellPrograms = Pick<
  Programs,
  'hunt' | 'claim' | 'apply' | 'combat' | 'feed'
>;

/** The passes both kinds of rules run alike. */
export type SharedPrograms = Omit<Programs, keyof CellPrograms>;

/**
 * Sets a pass's uniforms that stay for the match - floats, ints and uints by
 * name - besides the state, mask and size every pass reads.
 */
export type SetUniforms = (
  program: Program,
  floats: Record<string, number>,
  ints?: Record<string, number>,
  uints?: Record<string, number>
) => void;

/**
 * The rules the GPU cell passes compute the war by - what tells the integer
 * passes of ADR 0015 from the float ones. `GpuCellPasses` runs either alike;
 * everything that differs between them is here.
 */
export interface GpuRules {
  /**
   * How old every report the war takes is, in ticks - waited for, none
   * skipped: the integer passes', which every GPU computes alike. Null takes
   * them as the GPU finishes them, during the tick.
   */
  readonly reportLag: number | null;
  /** This context's cell passes, compiled once per context. */
  cellPrograms(gl: WebGL2RenderingContext): CellPrograms;
  /** The cell passes' uniforms that stay for the match. */
  setMatchUniforms(programs: Programs, set: SetUniforms): void;
  /** Hands the frame's uniforms to the claim, apply and combat passes. */
  uploadFrame(
    gl: WebGL2RenderingContext,
    programs: Programs,
    frame: GridFrame
  ): void;
  /** Hands the effects' circles to a pass that is in use. */
  uploadEffects(
    gl: WebGL2RenderingContext,
    at: Program['uniforms'],
    frame: GridFrame
  ): void;
  /** The draws' seed of a step. */
  seed(step: number): number;
}

/**
 * The integer cell passes of ADR 0015: draws seeded from the match's seed,
 * every step as long as a tick, and the report always exactly
 * `DETERMINISTIC_REPORT_LAG` ticks old - waited for when the GPU is slow.
 */
export class GpuIntRules implements GpuRules {
  public readonly reportLag = DETERMINISTIC_REPORT_LAG;
  private readonly ints = createIntFrameUniforms();

  public constructor(
    private readonly balance: GameBalance,
    private readonly matchSeed: number
  ) {}

  public cellPrograms(gl: WebGL2RenderingContext): CellPrograms {
    return compiledIntPrograms(gl);
  }

  /** Every rate as what it comes to in one step - see `intMatchUniforms`. */
  public setMatchUniforms(programs: Programs, set: SetUniforms): void {
    const ints = intMatchUniforms(this.balance);
    const intents = { uJitter: ints.jitter, uParentShare: ints.parentShare };
    const threshold = { uDivideThreshold: ints.divideThreshold };
    set(programs.claim, {}, intents, threshold);
    set(programs.apply, {}, intents, threshold);
    set(
      programs.combat,
      {},
      {
        uNutrientStep: ints.nutrientStep,
        uDefenceFactor: ints.defenceFactor,
        uFrontlinePressure: ints.frontlinePressure,
        uRegenStep: ints.regenStep,
        uOverchargeDecayStep: ints.overchargeDecayStep,
        uAntibioticStep: ints.antibioticStep,
        uToxinStep: ints.toxinStep,
        uMaxEnergy: ints.maxEnergy,
        uSuperMaxEnergy: ints.superMaxEnergy,
        uCaptureEnergy: ints.captureEnergy,
      },
      { uConsumeChance: ints.consumeChance }
    );
    set(programs.feed, {}, {}, { uFeed: ints.feed });
  }

  /** Converts the frame's uniforms into integers - a tick's step, not the frame's. */
  public uploadFrame(
    gl: WebGL2RenderingContext,
    programs: Programs,
    frame: GridFrame
  ): void {
    const u = frame.uniforms;
    const ints = fillIntCombatUniforms(
      fillIntFrameUniforms(this.ints, u),
      u,
      this.balance.combatDrainPerSec,
      frame.pelletCount
    );
    for (const program of [programs.claim, programs.apply]) {
      const at = program.uniforms;
      gl.useProgram(program.program);
      gl.uniform1iv(at['uSteps[0]'], u.steps);
      gl.uniform2iv(at['uTarget[0]'], ints.targets);
      gl.uniform1iv(at['uAggression[0]'], ints.aggression);
      gl.uniform1uiv(at['uDivideChance[0]'], ints.divideChance);
    }
    const combat = programs.combat.uniforms;
    gl.useProgram(programs.combat.program);
    gl.uniform3iv(combat['uPellets[0]'], ints.pellets);
    gl.uniform1i(combat['uPelletCount'], ints.pelletCount);
    gl.uniform1iv(combat['uAttack[0]'], ints.attack);
    gl.uniform1iv(combat['uDrain[0]'], ints.drain);
  }

  public uploadEffects(
    gl: WebGL2RenderingContext,
    at: Program['uniforms'],
    frame: GridFrame
  ): void {
    gl.uniform4iv(at['uEffects[0]'], frame.intEffects.circles);
    gl.uniform2iv(at['uEffectKinds[0]'], frame.intEffects.kinds);
  }

  public seed(step: number): number {
    return frameSeed(this.matchSeed, step);
  }
}

/**
 * The float cell passes - the rules of `BacteriaSimulation` as shaders,
 * each step as long as the frame, and the report taken as soon as the GPU
 * has it. No two GPUs need compute them alike.
 */
export class GpuFloatRules implements GpuRules {
  public readonly reportLag = null;

  public constructor(private readonly balance: GameBalance) {}

  public cellPrograms(gl: WebGL2RenderingContext): CellPrograms {
    return compiledFloatPrograms(gl);
  }

  public setMatchUniforms(programs: Programs, set: SetUniforms): void {
    const b = this.balance;
    const intents = {
      uJitter: b.jitter,
      uDivideThreshold: b.divideEnergyThreshold,
      uParentShare: b.parentEnergyShare,
    };
    set(programs.claim, intents);
    set(programs.apply, intents);
    set(programs.combat, {
      uDefenceFactor: b.defenceFactor,
      uFrontlinePressure: b.frontlinePressure,
      uCombatDrain: b.combatDrainPerSec,
      uRegen: b.energyRegenPerSec,
      uOverchargeDecay: b.overchargeDecayPerSec,
      uMaxEnergy: b.maxEnergy,
      uSuperMaxEnergy: b.superChargedMaxEnergy,
      uConsumeChance: b.consumeChance,
      uCaptureEnergy: b.captureEnergy,
    });
    set(programs.feed, { uFeed: b.feedEnergyPerCapture });
  }

  public uploadFrame(
    gl: WebGL2RenderingContext,
    programs: Programs,
    frame: GridFrame
  ): void {
    const u = frame.uniforms;
    for (const program of [programs.claim, programs.apply]) {
      const at = program.uniforms;
      gl.useProgram(program.program);
      gl.uniform1iv(at['uSteps[0]'], u.steps);
      gl.uniform2fv(at['uTarget[0]'], u.targets);
      gl.uniform1fv(at['uAggression[0]'], u.aggression);
      gl.uniform1fv(at['uDivideChance[0]'], u.divideChance);
      gl.uniform1fv(at['uDivideBudget[0]'], u.divideBudget);
    }
    const combat = programs.combat.uniforms;
    gl.useProgram(programs.combat.program);
    gl.uniform3fv(combat['uPellets[0]'], u.pellets);
    gl.uniform1i(combat['uPelletCount'], frame.pelletCount);
    gl.uniform1f(combat['uDt'], frame.deltaTimeSec);
    gl.uniform1fv(combat['uAttack[0]'], u.attack);
    gl.uniform1fv(combat['uToughness[0]'], u.toughness);
    gl.uniform1f(
      combat['uNutrientGain'],
      this.balance.nutrientDrainPerSec * frame.deltaTimeSec
    );
  }

  public uploadEffects(
    gl: WebGL2RenderingContext,
    at: Program['uniforms'],
    frame: GridFrame
  ): void {
    gl.uniform4fv(at['uEffects[0]'], frame.uniforms.effects);
    gl.uniform2iv(at['uEffectKinds[0]'], frame.uniforms.effectKinds);
  }

  public seed(step: number): number {
    return (step * 2654435761) >>> 0;
  }
}

/**
 * The compiled passes of each context. Every match gets a simulation of its
 * own, but compiling the shaders again each time would stall the start of
 * every match - so they are kept until the context is lost. Both kinds of
 * rules run the shared ones; each compiles only its own cell passes.
 */
const SHARED_PROGRAMS = new WeakMap<WebGL2RenderingContext, SharedPrograms>();

/** The float cell passes of each context. */
const FLOAT_PROGRAMS = new WeakMap<WebGL2RenderingContext, CellPrograms>();

/** The integer cell passes of each context. */
const INT_PROGRAMS = new WeakMap<WebGL2RenderingContext, CellPrograms>();

/** Drops a lost context's programs - it compiles them afresh once back. */
export function forgetPrograms(gl: WebGL2RenderingContext): void {
  SHARED_PROGRAMS.delete(gl);
  FLOAT_PROGRAMS.delete(gl);
  INT_PROGRAMS.delete(gl);
}

const COMMON_UNIFORMS = ['uState', 'uMask', 'uSize', 'uSeed'];
const WEAPON_UNIFORMS = ['uEffects[0]', 'uEffectKinds[0]', 'uEffectCount'];
const PELLET_UNIFORMS = ['uPellets[0]', 'uPelletCount', 'uPelletRadius'];
/** The intents' uniforms both kinds of pass share; the float ones add the budget. */
const INTENT_UNIFORMS = [
  'uKind',
  'uStep',
  'uSteps[0]',
  'uTarget[0]',
  'uAggression[0]',
  'uJitter',
  'uCellSize',
  'uHunt',
  'uHuntMore',
  'uDivideThreshold',
  'uDivideChance[0]',
  'uParentShare',
  ...WEAPON_UNIFORMS,
];

/** Compiles a pass with the uniforms every pass has, and its own. */
function programOf(gl: WebGL2RenderingContext) {
  return (fragment: string, uniforms: string[]): Program =>
    createProgram(gl, FULLSCREEN_VERTEX, fragment, [
      ...COMMON_UNIFORMS,
      ...uniforms,
    ]);
}

/** The passes both kinds of rules run, compiled once per context. */
export function compiledSharedPrograms(
  gl: WebGL2RenderingContext
): SharedPrograms {
  const cached = SHARED_PROGRAMS.get(gl);
  if (cached != null) {
    return cached;
  }
  const program = programOf(gl);
  const programs: SharedPrograms = {
    influence: program(INFLUENCE_FRAGMENT, ['uCellSize']),
    crush: program(CRUSH_FRAGMENT, []),
    report: program(REPORT_FRAGMENT, [
      'uEvents',
      'uPrevious',
      'uCellSize',
      'uBlocks',
      'uCountHill',
      ...PELLET_UNIFORMS,
    ]),
    effects: program(EFFECTS_FRAGMENT, [
      'uEvents',
      'uPreviousEffects',
      'uFade',
      'uTrack',
      ...PELLET_UNIFORMS,
    ]),
  };
  SHARED_PROGRAMS.set(gl, programs);
  return programs;
}

function compiledIntPrograms(gl: WebGL2RenderingContext): CellPrograms {
  const cached = INT_PROGRAMS.get(gl);
  if (cached != null) {
    return cached;
  }
  const program = programOf(gl);
  const programs = {
    hunt: program(INT_HUNT_FRAGMENT, ['uInfluence', 'uPair']),
    claim: program(INT_CLAIM_FRAGMENT, INTENT_UNIFORMS),
    apply: program(INT_APPLY_FRAGMENT, [...INTENT_UNIFORMS, 'uClaims']),
    combat: program(INT_COMBAT_FRAGMENT, [
      ...WEAPON_UNIFORMS,
      'uAttack[0]',
      'uDrain[0]',
      ...PELLET_UNIFORMS,
      'uNutrientStep',
      'uDefenceFactor',
      'uFrontlinePressure',
      'uRegenStep',
      'uOverchargeDecayStep',
      'uAntibioticStep',
      'uToxinStep',
      'uMaxEnergy',
      'uSuperMaxEnergy',
      'uCaptureEnergy',
      'uConsumeChance',
    ]),
    feed: program(INT_FEED_FRAGMENT, ['uFeed']),
  };
  INT_PROGRAMS.set(gl, programs);
  return programs;
}

function compiledFloatPrograms(gl: WebGL2RenderingContext): CellPrograms {
  const cached = FLOAT_PROGRAMS.get(gl);
  if (cached != null) {
    return cached;
  }
  const intents = [...INTENT_UNIFORMS, 'uDivideBudget[0]'];
  const program = programOf(gl);
  const programs: CellPrograms = {
    hunt: program(HUNT_FRAGMENT, ['uInfluence', 'uPair']),
    claim: program(CLAIM_FRAGMENT, intents),
    apply: program(APPLY_FRAGMENT, [...intents, 'uClaims']),
    combat: program(COMBAT_FRAGMENT, [
      ...WEAPON_UNIFORMS,
      'uDt',
      'uAttack[0]',
      'uToughness[0]',
      ...PELLET_UNIFORMS,
      'uNutrientGain',
      'uDefenceFactor',
      'uFrontlinePressure',
      'uCombatDrain',
      'uRegen',
      'uOverchargeDecay',
      'uMaxEnergy',
      'uSuperMaxEnergy',
      'uConsumeChance',
      'uCaptureEnergy',
    ]),
    feed: program(FEED_FRAGMENT, ['uFeed']),
  };
  FLOAT_PROGRAMS.set(gl, programs);
  return programs;
}
