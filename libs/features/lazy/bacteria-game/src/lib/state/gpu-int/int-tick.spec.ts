import { gameBalance } from '../game-balance';
import { ZONE_CODE, ZONE_SHIFT } from '../zones';
import { frameSeed } from './draws';
import { toQ14 } from './fixed-point';
import {
  createIntFrameUniforms,
  fillIntCombatUniforms,
  fillIntFrameUniforms,
} from './int-frame-uniforms';
import {
  DETERMINISTIC_REPORT_LAG,
  divideBudgetOf,
  readbacksToTake,
} from './int-readback';
import { IntGrid, IntPassScratch, intStateHash } from './int-reference';
import { intColonyCounts, intReferenceTick, IntTickInputs } from './int-tick';
import { intMatchUniforms } from './int-uniforms';

const WIDTH = 48;
const HEIGHT = 24;
const CELL_SIZE = 4;
const COLONIES = 2;
const match = intMatchUniforms(gameBalance);
/** Small, so the divide budget - and with it the report - matters. */
const CAPACITY = 180;
/** The read back buffers of the float simulation - `READBACK_SLOTS`. */
const SLOTS = 3;

/** Two colonies facing each other, agar between them, walls around. */
function scenario(): IntGrid {
  const g: IntGrid = {
    width: WIDTH,
    height: HEIGHT,
    state: new Uint16Array(WIDTH * HEIGHT * 4),
    mask: new Uint8Array(WIDTH * HEIGHT),
  };
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const cell = y * WIDTH + x;
      if (x === 0 || y === 0 || x === WIDTH - 1 || y === HEIGHT - 1) {
        g.mask[cell] = 1;
      } else if (x > 20 && x < 28) {
        g.mask[cell] = ZONE_CODE.agar << ZONE_SHIFT;
      }
      const owner =
        x > 4 && x < 12 && y > 6 && y < 18
          ? 1
          : x > 36 && x < 44 && y > 6 && y < 18
            ? 2
            : 0;
      if (owner !== 0) {
        g.state[cell * 4] = owner;
        g.state[cell * 4 + 1] = toQ14(0.9);
      }
    }
  }
  return g;
}

function inputs(tick: number, budget: number[]): IntTickInputs {
  const frame = fillIntFrameUniforms(createIntFrameUniforms(), {
    targets: [WIDTH * 0.8, HEIGHT * 0.5, WIDTH * 0.2, HEIGHT * 0.5],
    aggression: [0.5, 0.7],
    divideChance: [0.3, 0.3],
    divideBudget: budget,
  });
  fillIntCombatUniforms(
    frame,
    { attack: [1, 1.2], toughness: [1, 1], pellets: [] },
    gameBalance.combatDrainPerSec,
    0
  );
  return {
    pass: {
      ...frame,
      steps: [2, 2, 0, 0],
      seed: frameSeed(4242, tick),
      jitter: match.jitter,
      divideThreshold: match.divideThreshold,
      parentShare: match.parentShare,
      cellSize: CELL_SIZE,
    },
    combat: { frame, pelletRadius: gameBalance.nutrientRadius },
    match,
    moveSteps: 2,
    escapeSteps: 0,
  };
}

/**
 * Plays ticks the way `GpuSimulation.step` runs them: the frame's uniforms
 * from the report in hand, the passes, then taking in the read backs due
 * and asking for the last tick's report. `lateBy` says how many ticks after
 * it was asked for the GPU finishes a read back - the device's speed.
 */
function play(
  lateBy: (step: number) => number,
  lag: number | null,
  ticks = 36
): number[] {
  let grid = scenario();
  const scratch = new IntPassScratch(WIDTH, HEIGHT);
  const pending: { step: number; readyAt: number; counts: number[] }[] = [];
  let known = intColonyCounts(grid.state, COLONIES);
  let knownStep: number | null = null;
  let rendered: number[] | null = null;
  const hashes: number[] = [];
  for (let tick = 1; tick <= ticks; tick++) {
    const behind =
      lag ?? Math.max(SLOTS, knownStep === null ? 0 : tick - knownStep);
    const budget = known.map((count) =>
      divideBudgetOf(CAPACITY, count, behind)
    );
    grid = {
      ...grid,
      state: intReferenceTick(grid, inputs(tick, budget), scratch),
    };
    hashes.push(intStateHash(grid.state));

    const due = readbacksToTake(
      pending.map(({ step, readyAt }) => ({
        step,
        ready: readyAt <= tick,
        stale: false,
      })),
      tick,
      lag
    );
    for (const report of pending.splice(0, due)) {
      known = report.counts;
      knownStep = report.step;
    }
    if (rendered !== null && (lag !== null || pending.length < SLOTS)) {
      pending.push({
        step: tick - 1,
        readyAt: tick + lateBy(tick - 1),
        counts: rendered,
      });
    }
    rendered = intColonyCounts(grid.state, COLONIES);
  }
  return hashes;
}

describe('intReferenceTick', () => {
  it('grows and moves the colonies', () => {
    const before = intColonyCounts(scenario().state, COLONIES);
    const g = scenario();
    const after = intColonyCounts(
      intReferenceTick(g, inputs(1, [1, 1])),
      COLONIES
    );
    expect(after[0]).toBeGreaterThan(before[0]);
    expect(after[1]).toBeGreaterThan(before[1]);
  });

  it('leaves the grid it was given alone', () => {
    const g = scenario();
    const copy = g.state.slice();
    intReferenceTick(g, inputs(1, [1, 1]));
    expect(g.state).toEqual(copy);
  });
});

describe('the deterministic data flow', () => {
  it('plays the same however late the read backs arrive', () => {
    const fast = play(() => 1, DETERMINISTIC_REPORT_LAG);
    const slow = play(() => 3, DETERMINISTIC_REPORT_LAG);
    const uneven = play((step) => (step * 7) % 5, DETERMINISTIC_REPORT_LAG);
    expect(slow).toEqual(fast);
    expect(uneven).toEqual(fast);
  });

  it('would not, taking every report as soon as it is in', () => {
    // The float simulation's way: proof the reports matter in this scenario.
    expect(play(() => 3, null)).not.toEqual(play(() => 1, null));
  });
});
