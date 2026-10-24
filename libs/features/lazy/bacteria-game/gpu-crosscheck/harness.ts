/**
 * The browser side of the GPU cross-check (ADR 0015, step 6): plays a
 * scenario's ticks through the integer shaders, pass for pass in the order
 * of `intReferenceTick`, and hashes the state after every tick as
 * `intStateHash` does. Bundled by esbuild and run in Chromium on
 * SwiftShader by `gpu-int.crosscheck.ts`.
 */
import {
  createProgram,
  createQuad,
  createTarget,
  createTexture,
  FULLSCREEN_VERTEX,
  Program,
  Target,
} from '../src/lib/gl/gl-utils';
import {
  INT_APPLY_FRAGMENT,
  INT_CLAIM_FRAGMENT,
  INT_COMBAT_FRAGMENT,
  INT_FEED_FRAGMENT,
  INT_HUNT_FRAGMENT,
} from '../src/lib/gl/int-simulation-shaders';
import {
  CRUSH_FRAGMENT,
  INFLUENCE_FRAGMENT,
} from '../src/lib/gl/simulation-shaders';
import { INT_KIND, IntTickInputs } from '../src/engine';
import { CrosscheckScenario, playScenario, SCENARIOS } from './scenarios';

const UNIT = {
  state: 0,
  mask: 1,
  claims: 2,
  influence: 2,
  hunt: 3,
  huntMore: 4,
};

const COMMON = ['uState', 'uMask', 'uSize', 'uSeed', 'uCellSize'];
const EFFECTS = ['uEffects[0]', 'uEffectKinds[0]', 'uEffectCount'];
const INTENTS = [
  ...EFFECTS,
  'uKind',
  'uStep',
  'uSteps[0]',
  'uTarget[0]',
  'uAggression[0]',
  'uJitter',
  'uHunt',
  'uHuntMore',
  'uDivideThreshold',
  'uDivideChance[0]',
  'uParentShare',
];
/** The combat's match uniforms that are ints - the chance is a uint. */
const COMBAT_INTS = {
  uNutrientStep: 'nutrientStep',
  uDefenceFactor: 'defenceFactor',
  uFrontlinePressure: 'frontlinePressure',
  uRegenStep: 'regenStep',
  uOverchargeDecayStep: 'overchargeDecayStep',
  uAntibioticStep: 'antibioticStep',
  uToxinStep: 'toxinStep',
  uMaxEnergy: 'maxEnergy',
  uSuperMaxEnergy: 'superMaxEnergy',
  uCaptureEnergy: 'captureEnergy',
} as const;

/** The state hash after every tick of the scenario, on this GPU. */
export function gpuHashes(scenario: CrosscheckScenario): number[] {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2');
  if (gl == null) {
    throw new Error('No WebGL2');
  }
  return new IntPasses(gl, scenario).run();
}

class IntPasses {
  private readonly width: number;
  private readonly height: number;
  private readonly blocksX: number;
  private readonly blocksY: number;
  private readonly programs: Record<
    'influence' | 'hunt' | 'claim' | 'apply' | 'crush' | 'combat' | 'feed',
    Program
  >;
  private readonly states: Target[];
  private readonly mask: WebGLTexture;
  private readonly influence: Target;
  private readonly hunt: Target;
  private readonly huntMore: Target;
  private readonly claims: Target;
  private current = 0;
  private seed = 0;

  public constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly scenario: CrosscheckScenario
  ) {
    const { width, height } = scenario;
    const cellSize = scenario.cellSize;
    this.width = width;
    this.height = height;
    this.blocksX = Math.ceil(width / cellSize);
    this.blocksY = Math.ceil(height / cellSize);
    const program = (fragment: string, uniforms: string[]) =>
      createProgram(gl, FULLSCREEN_VERTEX, fragment, [...COMMON, ...uniforms]);
    this.programs = {
      influence: program(INFLUENCE_FRAGMENT, []),
      hunt: program(INT_HUNT_FRAGMENT, ['uInfluence', 'uPair']),
      claim: program(INT_CLAIM_FRAGMENT, INTENTS),
      apply: program(INT_APPLY_FRAGMENT, [...INTENTS, 'uClaims']),
      crush: program(CRUSH_FRAGMENT, []),
      combat: program(INT_COMBAT_FRAGMENT, [
        ...EFFECTS,
        ...Object.keys(COMBAT_INTS),
        'uAttack[0]',
        'uDrain[0]',
        'uPellets[0]',
        'uPelletCount',
        'uPelletRadius',
        'uConsumeChance',
      ]),
      feed: program(INT_FEED_FRAGMENT, ['uFeed']),
    };
    this.states = [
      createTarget(gl, gl.RGBA16UI, width, height),
      createTarget(gl, gl.RGBA16UI, width, height),
    ];
    this.mask = createTexture(gl, gl.R8UI, width, height, gl.NEAREST);
    this.influence = createTarget(gl, gl.RGBA16UI, this.blocksX, this.blocksY);
    this.hunt = createTarget(gl, gl.RGBA16I, this.blocksX, this.blocksY);
    this.huntMore = createTarget(gl, gl.RGBA16I, this.blocksX, this.blocksY);
    this.claims = createTarget(gl, gl.R8UI, width, height);
    gl.bindVertexArray(createQuad(gl).vao);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.bindTexture(gl.TEXTURE_2D, this.states[0].texture);
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      0,
      0,
      width,
      height,
      gl.RGBA_INTEGER,
      gl.UNSIGNED_SHORT,
      scenario.state
    );
    for (const { program, uniforms } of Object.values(this.programs)) {
      gl.useProgram(program);
      gl.uniform1i(uniforms['uState'], UNIT.state);
      gl.uniform1i(uniforms['uMask'], UNIT.mask);
      gl.uniform2i(uniforms['uSize'], width, height);
      gl.uniform1i(uniforms['uCellSize'], cellSize);
    }
    const { hunt, claim, apply } = this.programs;
    gl.useProgram(hunt.program);
    gl.uniform1i(hunt.uniforms['uInfluence'], UNIT.influence);
    for (const { program, uniforms } of [claim, apply]) {
      gl.useProgram(program);
      gl.uniform1i(uniforms['uHunt'], UNIT.hunt);
      gl.uniform1i(uniforms['uHuntMore'], UNIT.huntMore);
    }
    gl.useProgram(apply.program);
    gl.uniform1i(apply.uniforms['uClaims'], UNIT.claims);
  }

  public run(): number[] {
    const gl = this.gl;
    const pixels = new Uint32Array(this.width * this.height * 4);
    let mask: Uint8Array | null = null;
    return playScenario(this.scenario, (tickMask, inputs) => {
      if (tickMask !== mask) {
        mask = tickMask;
        gl.bindTexture(gl.TEXTURE_2D, this.mask);
        gl.texSubImage2D(
          gl.TEXTURE_2D,
          0,
          0,
          0,
          this.width,
          this.height,
          gl.RED_INTEGER,
          gl.UNSIGNED_BYTE,
          mask
        );
      }
      this.tick(inputs);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.states[this.current].framebuffer);
      gl.readPixels(
        0,
        0,
        this.width,
        this.height,
        gl.RGBA_INTEGER,
        gl.UNSIGNED_INT,
        pixels
      );
      return pixels;
    });
  }

  private tick(inputs: IntTickInputs): void {
    const gl = this.gl;
    const { pass, combat, match } = inputs;
    const p = this.programs;
    this.seed = pass.seed;
    this.bind(UNIT.mask, this.mask);

    // The hunt, from the tick's starting state.
    this.draw(p.influence, this.influence, this.blocksX, this.blocksY);
    this.bind(UNIT.influence, this.influence.texture);
    gl.useProgram(p.hunt.program);
    gl.uniform1i(p.hunt.uniforms['uPair'], 0);
    this.draw(p.hunt, this.hunt, this.blocksX, this.blocksY);
    gl.uniform1i(p.hunt.uniforms['uPair'], 1);
    this.draw(p.hunt, this.huntMore, this.blocksX, this.blocksY);
    this.bind(UNIT.hunt, this.hunt.texture);
    this.bind(UNIT.huntMore, this.huntMore.texture);

    const effects = pass.effects;
    for (const { program, uniforms } of [p.claim, p.apply, p.combat]) {
      gl.useProgram(program);
      gl.uniform4iv(
        uniforms['uEffects[0]'],
        effects?.circles ?? new Int32Array(16)
      );
      gl.uniform2iv(
        uniforms['uEffectKinds[0]'],
        effects?.kinds ?? new Int32Array(8)
      );
      gl.uniform1i(uniforms['uEffectCount'], effects?.count ?? 0);
    }
    for (const { program, uniforms } of [p.claim, p.apply]) {
      gl.useProgram(program);
      gl.uniform1iv(uniforms['uSteps[0]'], Int32Array.from(pass.steps));
      gl.uniform2iv(uniforms['uTarget[0]'], pass.targets);
      gl.uniform1iv(uniforms['uAggression[0]'], pass.aggression);
      gl.uniform1uiv(uniforms['uDivideChance[0]'], pass.divideChance);
      gl.uniform1i(uniforms['uJitter'], pass.jitter);
      gl.uniform1ui(uniforms['uDivideThreshold'], pass.divideThreshold);
      gl.uniform1i(uniforms['uParentShare'], pass.parentShare);
    }
    gl.useProgram(p.combat.program);
    const u = p.combat.uniforms;
    for (const [name, key] of Object.entries(COMBAT_INTS)) {
      gl.uniform1i(u[name], match[key]);
    }
    gl.uniform1ui(u['uConsumeChance'], match.consumeChance);
    gl.uniform1iv(u['uAttack[0]'], combat.frame.attack);
    gl.uniform1iv(u['uDrain[0]'], combat.frame.drain);
    gl.uniform3iv(u['uPellets[0]'], combat.frame.pellets);
    gl.uniform1i(u['uPelletCount'], combat.frame.pelletCount);
    gl.uniform1i(u['uPelletRadius'], combat.pelletRadius);
    gl.useProgram(p.feed.program);
    gl.uniform1ui(p.feed.uniforms['uFeed'], match.feed);

    for (let step = 0; step < inputs.escapeSteps; step++) {
      this.claimAndApply(INT_KIND.escape, step);
    }
    this.statePass(p.crush);
    this.statePass(p.combat);
    this.statePass(p.feed);
    this.claimAndApply(INT_KIND.divide, 0);
    for (let step = 0; step < inputs.moveSteps; step++) {
      this.claimAndApply(INT_KIND.move, step);
    }
  }

  private claimAndApply(kind: number, step: number): void {
    const gl = this.gl;
    const { claim, apply } = this.programs;
    for (const { program, uniforms } of [claim, apply]) {
      gl.useProgram(program);
      gl.uniform1i(uniforms['uKind'], kind);
      gl.uniform1i(uniforms['uStep'], step);
    }
    this.draw(claim, this.claims, this.width, this.height);
    this.bind(UNIT.claims, this.claims.texture);
    this.statePass(apply);
  }

  /** A pass from the current state into the other one, current after. */
  private statePass(program: Program): void {
    const next = 1 - this.current;
    this.draw(program, this.states[next], this.width, this.height);
    this.current = next;
  }

  private draw(
    program: Program,
    target: Target,
    width: number,
    height: number
  ): void {
    const gl = this.gl;
    gl.useProgram(program.program);
    gl.uniform1ui(program.uniforms['uSeed'], this.seed);
    this.bind(UNIT.state, this.states[this.current].texture);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
    gl.viewport(0, 0, width, height);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  private bind(unit: number, texture: WebGLTexture): void {
    this.gl.activeTexture(this.gl.TEXTURE0 + unit);
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
  }
}

/** The GPU the page renders with, to make sure it is SwiftShader. */
export function renderer(): string {
  const gl = document.createElement('canvas').getContext('webgl2');
  const info = gl?.getExtension('WEBGL_debug_renderer_info');
  return gl == null || info == null
    ? 'unknown'
    : String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL));
}

/** What the Playwright check calls in the page, by scenario name. */
export function crosscheck(name: string): number[] {
  return gpuHashes(SCENARIOS[name]());
}
