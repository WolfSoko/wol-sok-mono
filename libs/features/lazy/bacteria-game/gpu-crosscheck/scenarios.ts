/**
 * Fixed scenarios for the cross-check of the integer GPU passes against
 * their TypeScript reference (ADR 0015, step 6). Each one plays the whole
 * deterministic chain of a tick for a few dozen ticks: the Playwright check
 * runs them through the shaders on SwiftShader, the reference through
 * `intReferenceTick`, and both have to land on the hashes committed in
 * `golden-gpu-int.json` for the current `BALANCE_VERSION`.
 *
 * Everything here comes through the engine entry point, so the scenarios
 * build in Node and in the browser alike. They use no `Math.sin` and the
 * like, whose last bit may differ between engines.
 */
import {
  createIntEffectUniforms,
  createIntFrameUniforms,
  DETERMINISTIC_REPORT_LAG,
  divideBudgetOf,
  fillIntCombatUniforms,
  fillIntFrameUniforms,
  frameSeed,
  gameBalance,
  INT_ATTACK_MAX,
  INT_COLONIES,
  INT_EFFECT_RADIUS_MAX,
  INT_ENERGY_MAX,
  INT_MAX_EFFECTS,
  INT_PELLETS,
  intColonyCounts,
  IntEffect,
  intMatchUniforms,
  IntPassScratch,
  intReferenceTick,
  intStateHash,
  IntTickInputs,
  ONE_Q14,
  setIntEffect,
  toQ14,
  WALL_BIT,
  WEAPON_CODE,
  ZONE_CODE,
  ZONE_SHIFT,
} from '../src/engine';

export interface CrosscheckTick {
  inputs: IntTickInputs;
  /** The mask during the tick - a new one where a wall moved. */
  mask: Uint8Array;
}

export interface CrosscheckScenario {
  name: string;
  width: number;
  height: number;
  state: Uint16Array;
  /** Edge of a coarse cell of the hunt - `cellSize` in every tick's inputs. */
  cellSize: number;
  ticks: number;
  /** The most bacteria each colony may grow to - the divide budget's room. */
  capacity: readonly number[];
  /** The mask and the inputs of a tick, with the divide budget it may use. */
  tick(tick: number, divideBudget: readonly number[]): CrosscheckTick;
}

const WIDTH = 96;
const HEIGHT = 64;
const TICKS = 48;
const CELL_SIZE = gameBalance.influenceCellSize;
const MATCH = intMatchUniforms(gameBalance);

/** What one tick asks of the colonies, in the game's float units. */
interface TickPlan {
  /** Movement steps per colony. */
  steps: readonly number[];
  /** Crosshairs in cells, x and y per colony; NaN aims at nothing. */
  targets: readonly number[];
  aggression: readonly number[];
  divideChance: readonly number[];
  attack: readonly number[];
  toughness: readonly number[];
  /** Per pellet x and y in cells, and 1 while it is not eaten up. */
  pellets?: readonly number[];
  effects?: readonly IntEffect[];
  escapeSteps?: number;
}

function tickInputs(
  seed: number,
  tick: number,
  divideBudget: readonly number[],
  plan: TickPlan
): IntTickInputs {
  const frame = fillIntFrameUniforms(createIntFrameUniforms(), {
    targets: plan.targets,
    aggression: plan.aggression,
    divideChance: plan.divideChance,
    divideBudget,
  });
  const pellets = plan.pellets ?? [];
  fillIntCombatUniforms(
    frame,
    { attack: plan.attack, toughness: plan.toughness, pellets },
    gameBalance.combatDrainPerSec,
    pellets.length / 3
  );
  const effects = createIntEffectUniforms();
  const list = (plan.effects ?? []).slice(0, INT_MAX_EFFECTS);
  list.forEach((effect, index) => {
    setIntEffect(effects, index, effect);
  });
  effects.count = list.length;
  return {
    pass: {
      ...frame,
      steps: plan.steps,
      seed: frameSeed(seed, tick),
      jitter: MATCH.jitter,
      divideThreshold: MATCH.divideThreshold,
      parentShare: MATCH.parentShare,
      cellSize: CELL_SIZE,
      effects,
    },
    combat: { frame, pelletRadius: gameBalance.nutrientRadius },
    match: MATCH,
    moveSteps: Math.max(...plan.steps),
    escapeSteps: plan.escapeSteps ?? 0,
  };
}

/** A deterministic stream of fractions 0..1, an LCG in 32 bit ints. */
function fractions(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    return s / 4294967296;
  };
}

class Grid {
  public readonly state = new Uint16Array(WIDTH * HEIGHT * 4);
  public readonly mask = new Uint8Array(WIDTH * HEIGHT);

  public border(): this {
    for (let y = 0; y < HEIGHT; y++) {
      for (let x = 0; x < WIDTH; x++) {
        if (x === 0 || y === 0 || x === WIDTH - 1 || y === HEIGHT - 1) {
          this.mask[y * WIDTH + x] |= WALL_BIT;
        }
      }
    }
    return this;
  }

  public zone(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    code: number
  ): this {
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const cell = y * WIDTH + x;
        this.mask[cell] = (this.mask[cell] & WALL_BIT) | (code << ZONE_SHIFT);
      }
    }
    return this;
  }

  public wall(x0: number, y0: number, x1: number, y1: number): this {
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        this.mask[y * WIDTH + x] |= WALL_BIT;
      }
    }
    return this;
  }

  /** Fills a disc of free cells with `owner` (slot + 1). */
  public colony(
    cx: number,
    cy: number,
    radius: number,
    owner: number,
    energy: () => number
  ): this {
    for (let y = 0; y < HEIGHT; y++) {
      for (let x = 0; x < WIDTH; x++) {
        const cell = y * WIDTH + x;
        const inside = (x - cx) ** 2 + (y - cy) ** 2 < radius * radius;
        if (inside && (this.mask[cell] & WALL_BIT) === 0) {
          this.state[cell * 4] = owner;
          this.state[cell * 4 + 1] = energy();
        }
      }
    }
    return this;
  }
}

/**
 * Four colonies across walls and every kind of zone, each weapon fired at
 * some point - several at once, on enemies and on their own - and pellets
 * that come and go.
 */
function zonesAndWeapons(): CrosscheckScenario {
  const random = fractions(7);
  const energy = () => toQ14(0.5 + random() * 0.5);
  const grid = new Grid()
    .border()
    .zone(1, 1, 24, 26, ZONE_CODE.ice)
    .zone(72, 38, 95, 63, ZONE_CODE.heat)
    .zone(40, 26, 56, 38, ZONE_CODE.agar)
    .zone(40, 1, 56, 16, ZONE_CODE.antibiotic)
    .zone(1, 44, 20, 63, ZONE_CODE.hill)
    .wall(48, 1, 49, 18)
    .wall(48, 46, 49, 63)
    .wall(1, 32, 18, 33)
    .wall(78, 32, 95, 33)
    .colony(28, 20, 10, 1, energy)
    .colony(54, 20, 10, 2, energy)
    .colony(28, 44, 10, 3, energy)
    .colony(54, 44, 10, 4, energy);
  const weapon = WEAPON_CODE;
  const tickAt = (tick: number, budget: readonly number[]): CrosscheckTick => {
    const effects: IntEffect[] = [];
    const fire = (
      x: number,
      y: number,
      radius: number,
      hostile: boolean,
      kind: number,
      owner: number
    ) => effects.push({ x, y, radius, hostile, kind, owner });
    if (tick >= 3 && tick < 20)
      fire(49.7, 22.6, 8, true, weapon['toxin-bomb'], 1);
    if (tick >= 10 && tick < 32)
      fire(55.5, 40.75, 9, true, weapon['cryo-pulse'], 3);
    if (tick >= 16) fire(54, 20, 7, false, weapon['agar-bloom'], 2);
    if (tick % 11 === 3) fire(28.4, 20.6, 6, true, weapon['phage-strike'], 4);
    if (tick >= 30) fire(28, 44, 8, false, weapon['biofilm-shield'], 3);
    return {
      mask: grid.mask,
      inputs: tickInputs(0x5eed1234, tick, budget, {
        steps: [3, 2, 3, 1],
        // Each colony aims at the one across, one of them back and forth.
        targets: [54, 22, 28, 42, tick % 16 < 8 ? 50 : 62, 44, 28, 20],
        aggression: [0.5, 0.2, 0.8, 1],
        divideChance: [0.02, 0.05, 0.03, 0.04],
        attack: [1, 1.6, 0.8, 2.4],
        toughness: [1, 0.6, 1.4, 1],
        pellets: [41.7, 20.2, 1, 28.5, 32, tick % 20 < 10 ? 1 : 0, 48, 46.9, 1],
        effects,
      }),
    };
  };
  return {
    name: 'zones-and-weapons',
    width: WIDTH,
    height: HEIGHT,
    state: grid.state,
    cellSize: CELL_SIZE,
    ticks: TICKS,
    capacity: [900, 400, 900, 900],
    tick: tickAt,
  };
}

/**
 * A wall bar sweeping through a colony, and a block that drops onto the
 * other one: the bacteria a wall lands on escape over the free cells near
 * it, those it buries deeper than the escape reaches are crushed.
 */
function movingWalls(): CrosscheckScenario {
  const random = fractions(11);
  const energy = () => toQ14(0.4 + random() * 0.6);
  const start = new Grid()
    .border()
    .zone(60, 10, 80, 30, ZONE_CODE.agar)
    .colony(30, 32, 14, 1, energy)
    .colony(70, 32, 12, 2, energy);
  const tickAt = (tick: number, budget: readonly number[]): CrosscheckTick => {
    const grid = new Grid();
    grid.mask.set(start.mask);
    // One cell further every second tick, from x = 12 to x = 35.
    const bar = 12 + (tick >> 1);
    grid.wall(bar, 10, bar + 2, 54);
    if (tick >= 20) {
      grid.wall(64, 26, 76, 38);
    }
    const moved = tick === 1 || tick % 2 === 0 || tick === 20;
    return {
      mask: grid.mask,
      inputs: tickInputs(0xc0ffee, tick, budget, {
        steps: [2, 2, 0, 0],
        targets: [
          70,
          32,
          30,
          32,
          Number.NaN,
          Number.NaN,
          Number.NaN,
          Number.NaN,
        ],
        aggression: [0.6, 0.4, 0, 0],
        divideChance: [0.05, 0.05, 0, 0],
        attack: [1, 1.2, 0, 0],
        toughness: [1, 1, 1, 1],
        escapeSteps: moved ? 3 : 0,
      }),
    };
  };
  return {
    name: 'moving-walls',
    width: WIDTH,
    height: HEIGHT,
    state: start.state,
    cellSize: CELL_SIZE,
    ticks: TICKS,
    capacity: [700, 500, 0, 0],
    tick: tickAt,
  };
}

/**
 * Two players and two neutral colonies in slots 3 and 4, which neither
 * move nor aim but divide and fight back where the players reach them.
 */
function neutralColonies(): CrosscheckScenario {
  const random = fractions(23);
  const energy = () => toQ14(0.3 + random() * 0.7);
  const grid = new Grid()
    .border()
    .zone(40, 20, 56, 44, ZONE_CODE.heat)
    .colony(14, 32, 10, 1, energy)
    .colony(82, 32, 10, 2, energy)
    .colony(48, 14, 8, 3, energy)
    .colony(48, 50, 8, 4, energy);
  const tickAt = (tick: number, budget: readonly number[]): CrosscheckTick => {
    return {
      mask: grid.mask,
      inputs: tickInputs(0xbac7e7, tick, budget, {
        steps: [3, 3, 0, 0],
        targets: [
          48,
          14,
          48,
          50,
          Number.NaN,
          Number.NaN,
          Number.NaN,
          Number.NaN,
        ],
        aggression: [0.9, 0.7, 0, 0],
        divideChance: [0.04, 0.04, 0.02, 0.02],
        attack: [1.2, 1, 0.7, 0.7],
        toughness: [1, 1, 1.5, 1.5],
        pellets: [48, 32, 1],
      }),
    };
  };
  return {
    name: 'neutral-colonies',
    width: WIDTH,
    height: HEIGHT,
    state: grid.state,
    cellSize: CELL_SIZE,
    ticks: TICKS,
    capacity: [2000, 2000, 200, 200],
    tick: tickAt,
  };
}

/**
 * The bounds the fixed point formats are sized for: a grid packed full at
 * the most energy a bacterium holds, the largest attack and drain, full
 * aggression and divide chances, crosshairs far off the grid, every pellet
 * and every effect at once with the widest radius.
 */
function boundExtremes(): CrosscheckScenario {
  const grid = new Grid()
    .border()
    .zone(1, 1, 48, 32, ZONE_CODE.heat)
    .zone(48, 32, 95, 63, ZONE_CODE.agar);
  const half = (value: number) => value >> 1;
  for (let y = 1; y < HEIGHT - 1; y++) {
    for (let x = 1; x < WIDTH - 1; x++) {
      const cell = y * WIDTH + x;
      grid.state[cell * 4] =
        1 + (x < half(WIDTH) ? 0 : 1) + (y < half(HEIGHT) ? 0 : 2);
      grid.state[cell * 4 + 1] = INT_ENERGY_MAX;
    }
  }
  const pellets: number[] = [];
  for (let i = 0; i < INT_PELLETS; i++) {
    pellets.push(6 + i * 5.5, 8 + (i % 4) * 14.25, 1);
  }
  const attackMax = INT_ATTACK_MAX / ONE_Q14;
  const tickAt = (tick: number, budget: readonly number[]): CrosscheckTick => {
    const far = tick % 2 === 0 ? 1e6 : -1e6;
    const effects: IntEffect[] = [
      {
        x: 48,
        y: 32,
        radius: INT_EFFECT_RADIUS_MAX,
        hostile: true,
        kind: WEAPON_CODE['toxin-bomb'],
        owner: 1,
      },
      {
        x: 20,
        y: 20,
        radius: 30,
        hostile: true,
        kind: WEAPON_CODE['cryo-pulse'],
        owner: 2,
      },
      {
        x: 70,
        y: 45,
        radius: 25,
        hostile: false,
        kind: WEAPON_CODE['agar-bloom'],
        owner: 4,
      },
      {
        x: 48,
        y: 32,
        radius: 12,
        hostile: true,
        kind: WEAPON_CODE['phage-strike'],
        owner: 3,
      },
    ];
    return {
      mask: grid.mask,
      inputs: tickInputs(0xffffffff, tick, budget, {
        steps: [4, 4, 4, 4],
        targets: [far, far, -far, far, far, -far, -far, -far],
        aggression: [1, 1, 1, 1],
        divideChance: [1, 1, 1, 1],
        attack: Array.from(
          { length: INT_COLONIES },
          (_, slot) => attackMax * (slot + 1)
        ),
        toughness: [100, 100, 100, 100],
        pellets,
        effects,
      }),
    };
  };
  return {
    name: 'bound-extremes',
    width: WIDTH,
    height: HEIGHT,
    state: grid.state,
    cellSize: CELL_SIZE,
    ticks: TICKS,
    capacity: [1e6, 1e6, 1e6, 1e6],
    tick: tickAt,
  };
}

export const SCENARIOS: Readonly<Record<string, () => CrosscheckScenario>> = {
  'zones-and-weapons': zonesAndWeapons,
  'moving-walls': movingWalls,
  'neutral-colonies': neutralColonies,
  'bound-extremes': boundExtremes,
};

/**
 * Plays the scenario's ticks through `runTick`, which returns the state
 * after the tick, and hashes each. The data flow is the deterministic
 * simulation's: a tick first takes the report due - the colony counts of
 * `DETERMINISTIC_REPORT_LAG` ticks ago, or the start's before there is one
 * - makes the divide budget of it, then runs its passes, and the report of
 * its own state is asked for after them.
 */
export function playScenario(
  scenario: CrosscheckScenario,
  runTick: (mask: Uint8Array, inputs: IntTickInputs) => ArrayLike<number>
): number[] {
  const reports = [intColonyCounts(scenario.state, INT_COLONIES)];
  const hashes: number[] = [];
  for (let tick = 1; tick <= scenario.ticks; tick++) {
    const report = reports[Math.max(0, tick - DETERMINISTIC_REPORT_LAG)];
    const budget = report.map((count, slot) =>
      divideBudgetOf(scenario.capacity[slot], count, DETERMINISTIC_REPORT_LAG)
    );
    const { mask, inputs } = scenario.tick(tick, budget);
    const state = runTick(mask, inputs);
    hashes.push(intStateHash(state));
    reports.push(intColonyCounts(state, INT_COLONIES));
  }
  return hashes;
}

/** The reference's state hash after every tick of the scenario. */
export function referenceHashes(scenario: CrosscheckScenario): number[] {
  const { width, height } = scenario;
  const scratch = new IntPassScratch(width, height);
  let state = scenario.state;
  return playScenario(scenario, (mask, inputs) => {
    state = intReferenceTick({ width, height, state, mask }, inputs, scratch);
    return state;
  });
}
