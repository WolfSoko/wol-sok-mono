import type { ColonySpawn } from '../bacteria-simulation';
import { colonyCapacity, gameBalance } from '../game-balance';
import {
  DETERMINISTIC_REPORT_LAG,
  divideBudgetOf,
} from '../gpu-int/int-readback';
import { MAX_GPU_COLONIES, REPORT_ROWS } from '../grid-format';
import { GameMap } from '../maps';
import { createPlayer, Player } from '../player.model';
import type {
  CellPasses,
  CellPassesHost,
  GridArena,
  GridFrame,
  GridTick,
  ReportSink,
} from './cell-passes';
import { GridWar, READBACK_SLOTS } from './grid-war';

const WIDTH = 64;
const HEIGHT = 32;
const TICK = 0.05;

const plainMap: GameMap = {
  id: 'plain',
  name: 'Plain',
  description: 'No walls',
  createWalls: () => [],
};

/** A gate across the middle that shuts after the first tick. */
const gateMap: GameMap = {
  ...plainMap,
  id: 'gate',
  createDynamicWalls: (_width, height, timeSec) => [
    { x: 30, y: 0, width: 2, height, solid: timeSec > TICK * 1.5, warning: 0 },
  ],
};

/** A report the passes hand over, by colony slot. */
interface ReportCounts {
  counts: number[];
  captured?: number[];
  lost?: number[];
  /** Bacteria of slot 0 by each pellet. */
  eatersOfFirst?: number;
}

/** The raw report of `counts` on `arena`, as the passes read it back. */
function rawReport(arena: GridArena, report: ReportCounts): Uint32Array {
  const { layout } = arena;
  const data = new Uint32Array(layout.width * layout.height * 4);
  const texel = (x: number, y: number) => (y * layout.width + x) * 4;
  const pelletRow = 2 * layout.blocksY;
  report.counts.forEach((count, slot) => {
    data[texel(slot, 0) + slot] = count;
    data[texel(0, pelletRow + REPORT_ROWS.captures) + slot] =
      report.captured?.[slot] ?? 0;
    data[texel(0, pelletRow + REPORT_ROWS.losses) + slot] =
      report.lost?.[slot] ?? 0;
  });
  data[texel(0, pelletRow) + 2] = report.eatersOfFirst ?? 0;
  return data;
}

/** Cell passes that only note what the war asks of them. */
class StubPasses implements CellPasses {
  public readonly kind = 'int';
  public readonly calls: string[] = [];
  public readonly ticks: GridTick[] = [];
  public readonly frames: (Pick<GridFrame, 'pelletCount' | 'effectCount'> & {
    divideBudget: number[];
  })[] = [];
  public host: CellPassesHost | null = null;
  public arena: GridArena | null = null;
  /** The report to hand over at the next collection, or tick. */
  public next: ReportCounts | null = null;
  /** The pellets' generations as the last tick ran. */
  public generation: readonly number[] = [];

  public constructor(public readonly deterministic: boolean) {}

  public attach(host: CellPassesHost): void {
    this.host = host;
  }

  public ready(): boolean {
    return this.arena != null;
  }

  public allocate(arena: GridArena): void {
    this.arena = arena;
    this.calls.push('allocate');
  }

  public startMatch(): void {
    this.calls.push('startMatch');
  }

  public loadMask(): void {
    this.calls.push('loadMask');
  }

  public loadState(): void {
    this.calls.push('loadState');
  }

  public uploadFrame(frame: GridFrame): void {
    this.calls.push('uploadFrame');
    this.frames.push({
      pelletCount: frame.pelletCount,
      effectCount: frame.effectCount,
      divideBudget: Array.from(frame.uniforms.divideBudget.slice(0, 2)),
    });
  }

  public collectReports(step: number, sink: ReportSink): void {
    this.calls.push('collect');
    this.handOver(step - 1, sink);
  }

  public runTick(tick: GridTick, sink: ReportSink): void {
    this.calls.push('runTick');
    this.ticks.push({ ...tick });
    if (!this.deterministic) {
      this.handOver(tick.step, sink);
    }
    this.generation = tick.generation.slice();
  }

  public colonyLayers(): [] {
    return [];
  }

  public readState(): null {
    return null;
  }

  public dispose(): void {
    this.calls.push('dispose');
  }

  private handOver(step: number, sink: ReportSink): void {
    if (this.next == null || this.arena == null) {
      return;
    }
    sink.take(rawReport(this.arena, this.next), step, this.generation);
    this.next = null;
  }
}

function spawn(playerId: number, x: number): ColonySpawn {
  return { playerId, color: [255, 0, 0, 255], x, y: 16, radius: 3 };
}

/** A war of two colonies over stub passes, sized and started. */
function war(deterministic: boolean, map: GameMap = plainMap) {
  const passes = new StubPasses(deterministic);
  const grid = new GridWar(passes, gameBalance, () => 0.5);
  grid.setMap(map);
  grid.resize(WIDTH, HEIGHT);
  grid.init([spawn(1, 10), spawn(2, 50)]);
  const players: Player[] = [
    createPlayer({ id: 1, x: 40, y: 16 }),
    createPlayer({ id: 2, x: 20, y: 16 }),
  ];
  passes.calls.length = 0;
  return { passes, grid, players };
}

describe('GridWar', () => {
  it('takes its kind from the passes, and a ruleset only from deterministic ones', () => {
    expect(war(true).grid).toMatchObject({ kind: 'int', ruleset: 'gpu-int' });
    expect(war(false).grid).toMatchObject({ kind: 'int', ruleset: null });
  });

  it('collects a deterministic match’s reports before anything of the tick reads them', () => {
    const { passes, grid, players } = war(true);
    grid.step(players, TICK);
    expect(passes.calls).toEqual([
      'collect',
      'loadMask',
      'uploadFrame',
      'runTick',
    ]);
  });

  it('lets passes that are not deterministic hand reports over in the tick', () => {
    const { passes, grid, players } = war(false);
    grid.step(players, TICK);
    expect(passes.calls).toEqual(['loadMask', 'uploadFrame', 'runTick']);
  });

  it('runs nothing before the passes are sized, nor for a frame of no time', () => {
    const passes = new StubPasses(true);
    const grid = new GridWar(passes, gameBalance, () => 0.5);
    grid.init([spawn(1, 10)]);
    grid.step([], TICK);
    expect(passes.calls).toEqual(['startMatch']);

    const sized = war(true);
    sized.grid.step(sized.players, 0);
    expect(sized.passes.calls).toEqual([]);
  });

  it('escapes and loads the mask only in the tick after a wall moved', () => {
    const { passes, grid, players } = war(true, gateMap);
    grid.step(players, TICK);
    passes.calls.length = 0;
    grid.step(players, TICK);
    expect(passes.calls).toContain('loadMask');
    expect(passes.ticks[1].escapeSteps).toBeGreaterThan(0);
    passes.calls.length = 0;
    grid.step(players, TICK);
    expect(passes.calls).not.toContain('loadMask');
    expect(passes.ticks[2].escapeSteps).toBe(0);
  });

  it('turns a report into the scoreboard and the events, and hands its step on', () => {
    const { passes, grid, players } = war(true);
    grid.step(players, TICK);
    passes.next = { counts: [7, 4], captured: [2, 0], lost: [0, 3] };
    grid.step(players, TICK);

    expect(grid.summaries().map(({ count }) => count)).toEqual([7, 4]);
    // Three lost, two of them captured: one crushed.
    expect(grid.getEvents()).toMatchObject({ captures: 2, crushed: 1 });
    expect(passes.ticks[1]).toMatchObject({ step: 2, reportStep: 1 });
    expect(passes.ticks[1].report?.colonies[0].count).toBe(7);
    expect(grid.blockCounts()).not.toBeNull();
  });

  it('counts each capture once, however many reports carry the total', () => {
    const { passes, grid, players } = war(false);
    passes.next = { counts: [7, 4], captured: [2, 0] };
    grid.step(players, TICK);
    passes.next = { counts: [7, 4], captured: [2, 0] };
    grid.step(players, TICK);
    expect(grid.getEvents().captures).toBe(0);
  });

  it('drains a pellet by the report’s eaters, unless it moved since', () => {
    const { passes, grid, players } = war(false);
    grid.step(players, TICK);
    const pellet = grid.getNutrients()[0];
    const before = pellet.amount;
    passes.next = { counts: [7, 4], eatersOfFirst: 5 };
    grid.step(players, TICK);
    expect(pellet.amount).toBeLessThan(before);

    const drained = pellet.amount;
    passes.generation = passes.generation.map((generation) => generation + 1);
    passes.next = { counts: [7, 4], eatersOfFirst: 5 };
    grid.step(players, TICK);
    expect(pellet.amount).toBe(drained);
  });

  it('hands the passes the pellets and the effects that act on cells', () => {
    const { passes, grid, players } = war(true);
    grid.addEffect({
      weapon: 'toxin-bomb',
      owner: 1,
      x: 20,
      y: 16,
      radius: 4,
      remainingSec: 1,
      durationSec: 1,
    });
    grid.step(players, TICK);
    expect(passes.frames[0].effectCount).toBe(1);
    expect(passes.frames[0].pelletCount).toBe(grid.getNutrients().length);
  });

  it('starts the match over when the passes were set up afresh, loading the mask again', () => {
    const { passes, grid, players } = war(true);
    grid.step(players, TICK);
    passes.calls.length = 0;
    passes.host?.restart();
    expect(passes.calls).toEqual(['startMatch', 'loadState']);
    grid.step(players, TICK);
    expect(passes.calls).toContain('loadMask');
  });

  it('budgets division by the report a deterministic tick collected first, a fixed lag old', () => {
    const { passes, grid, players } = war(true);
    grid.step(players, TICK);
    passes.next = { counts: [100, 4] };
    grid.step(players, TICK);
    // No report for a while: the lag stays what it is, however old the last.
    for (let tick = 0; tick < 5; tick++) {
      grid.step(players, TICK);
    }
    const capacity = colonyCapacity(gameBalance, 2);
    const budget = divideBudgetOf(capacity, 100, DETERMINISTIC_REPORT_LAG);
    expect(passes.frames[1].divideBudget[0]).toBeCloseTo(budget);
    expect(passes.frames[6].divideBudget[0]).toBeCloseTo(budget);
  });

  it('budgets division of passes that are not deterministic by how far the report is behind', () => {
    const { passes, grid, players } = war(false);
    passes.next = { counts: [100, 4] };
    grid.step(players, TICK);
    for (let tick = 0; tick < 6; tick++) {
      grid.step(players, TICK);
    }
    const capacity = colonyCapacity(gameBalance, 2);
    // Read backs in flight at least, even right after the report came in.
    expect(passes.frames[1].divideBudget[0]).toBeCloseTo(
      divideBudgetOf(capacity, 100, READBACK_SLOTS)
    );
    // Six ticks after the report of tick 1.
    expect(passes.frames[6].divideBudget[0]).toBeCloseTo(
      divideBudgetOf(capacity, 100, 6)
    );
  });

  it('runs no more colonies than the passes hold', () => {
    const { grid } = war(true);
    const crowd = Array.from({ length: MAX_GPU_COLONIES + 1 }, (_, slot) =>
      spawn(slot + 1, 4 + slot * 4)
    );
    expect(() => grid.init(crowd)).toThrow();
  });

  it('lets the passes go with it', () => {
    const { passes, grid } = war(true);
    grid.dispose();
    expect(passes.calls).toEqual(['dispose']);
  });
});
