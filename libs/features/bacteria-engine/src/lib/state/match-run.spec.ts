import { matchChecksum } from './checksum';
import { MatchEngine } from './match-engine';
import { MatchArena, MatchRun, RunnableEngine } from './match-run';
import { MatchPlan, planMatch } from './match-setup';
import { Player } from './player.model';
import { MatchOutcome } from './win-conditions';

const ARENA: MatchArena = { width: 320, height: 140 };
const OUTCOME: MatchOutcome = { winner: null, reason: 'time' };

/** An engine that counts its ticks and ends at `endsAt`, if anywhere. */
class FakeEngine implements RunnableEngine {
  public tickCount = 0;
  public disposed = 0;
  public readonly arenas: MatchArena[] = [];
  public readonly players: readonly Player[] = [];

  public constructor(private readonly endsAt: number | null = null) {}

  public tick(width: number, height: number): void {
    this.arenas.push({ width, height });
    this.tickCount++;
  }

  public outcome(): MatchOutcome | null {
    return this.endsAt !== null && this.tickCount >= this.endsAt
      ? OUTCOME
      : null;
  }

  public dispose(): void {
    this.disposed++;
  }
}

/** A run on fake engines, with every engine it built. */
function fakeRun(
  lastTick: number,
  endsAt: number | null = null
): { run: MatchRun<FakeEngine>; built: FakeEngine[] } {
  const built: FakeEngine[] = [];
  const run = new MatchRun(
    () => {
      const engine = new FakeEngine(endsAt);
      built.push(engine);
      return engine;
    },
    ARENA,
    lastTick
  );
  return { run, built };
}

/** Plays the frames a seek takes, as a view would. */
function finishSeek(run: MatchRun<RunnableEngine>): void {
  for (let frame = 0; run.seeking && frame < 1000; frame++) {
    run.advance(1);
  }
}

describe('MatchRun', () => {
  it('ticks the engine with the arena it was built for', () => {
    const { run, built } = fakeRun(10);

    expect(run.advance(3)).toBe(3);
    expect(built[0].arenas).toEqual([ARENA, ARENA, ARENA]);
    expect(run.tickCount).toBe(3);
    expect(run.over).toBe(false);
  });

  it('stops at the last tick without an outcome', () => {
    const { run } = fakeRun(5);

    expect(run.advance(Infinity)).toBe(5);
    expect(run.over).toBe(true);
    expect(run.advance(1)).toBe(0);
    expect(run.result()).toMatchObject({ outcome: null, ticks: 5 });
  });

  it('ends with an outcome on the last tick', () => {
    const { run } = fakeRun(5, 5);

    run.advance(Infinity);

    expect(run.result()).toMatchObject({ outcome: OUTCOME, ticks: 5 });
  });

  it('plays no tick after an outcome before the last tick', () => {
    const { run } = fakeRun(100, 7);

    expect(run.advance(50)).toBe(7);
    expect(run.over).toBe(true);
    expect(run.advance(50)).toBe(0);
  });

  it('stops after the tick its deadline expires on', () => {
    const { run } = fakeRun(100);
    let calls = 0;

    expect(run.advance(50, () => ++calls >= 2)).toBe(2);
  });

  it('seeks forwards by playing on, without a new engine', () => {
    const { run, built } = fakeRun(100);
    run.advance(10);

    run.seek(40);
    expect(run.seeking).toBe(true);
    expect(run.shownTick).toBe(40);
    finishSeek(run);

    expect(run.seeking).toBe(false);
    expect(run.tickCount).toBe(40);
    expect(built).toHaveLength(1);
  });

  it('seeks back from the first tick again, on a new engine', () => {
    const { run, built } = fakeRun(100);
    run.advance(30);

    run.seek(10);
    finishSeek(run);

    expect(run.tickCount).toBe(10);
    expect(built).toHaveLength(2);
    expect(built[0].disposed).toBe(1);
    expect(run.engine).toBe(built[1]);
  });

  it('keeps its engine when a seek back fails to build a new one', () => {
    const first = new FakeEngine();
    let builds = 0;
    const run = new MatchRun(
      () => {
        if (builds++ > 0) {
          throw new Error('No engine');
        }
        return first;
      },
      ARENA,
      100
    );
    run.advance(30);

    expect(() => run.seek(10)).toThrow('No engine');
    expect(run.engine).toBe(first);
    expect(first.disposed).toBe(0);
    expect(run.advance(1)).toBe(1);
  });

  it('plays a seek across frames as its deadline allows', () => {
    const { run } = fakeRun(100);

    run.seek(50);
    run.advance(1, () => true);

    expect(run.tickCount).toBe(1);
    expect(run.seeking).toBe(true);
  });

  it('seeks no further than the last tick, nor before the first', () => {
    const { run } = fakeRun(20);

    run.seek(10_000);
    finishSeek(run);
    expect(run.tickCount).toBe(20);
    expect(run.over).toBe(true);

    run.seek(-5);
    expect(run.tickCount).toBe(0);
    expect(run.over).toBe(false);
  });

  it('ends a seek where the match ends', () => {
    const { run } = fakeRun(100, 30);

    run.seek(80);
    finishSeek(run);

    expect(run.tickCount).toBe(30);
    expect(run.seeking).toBe(false);
  });

  it('lets go of its engine once and plays nothing after', () => {
    const { run, built } = fakeRun(100);

    run.dispose();
    run.dispose();
    run.seek(0);

    expect(built[0].disposed).toBe(1);
    expect(built).toHaveLength(1);
    expect(run.advance(5)).toBe(0);
  });

  describe('on a real match', () => {
    const PLAN: MatchPlan = {
      levelId: 'petri-dish',
      mode: 'vs-computer',
      difficulty: 'hard',
      colors: ['orange', 'blue'],
      headStart: 0,
      width: ARENA.width,
      height: ARENA.height,
      seed: 1234,
    };
    const build = (): MatchEngine => {
      const { spawns, options } = planMatch(PLAN);
      return new MatchEngine(spawns, options);
    };

    it('gives the checksum of the war it reached', () => {
      const run = new MatchRun(build, ARENA, 120);
      try {
        run.advance(Infinity);
        const result = run.result();
        expect(result.ticks).toBe(120);
        expect(result.checksum).toBe(matchChecksum(run.engine.players));
      } finally {
        run.dispose();
      }
    });

    it('seeks on and back to the war it reaches when played straight', () => {
      const straight = new MatchRun(build, ARENA, 120);
      const seeking = new MatchRun(build, ARENA, 120);
      const again = new MatchRun(build, ARENA, 120);
      try {
        straight.advance(60);
        seeking.seek(60);
        finishSeek(seeking);
        expect(seeking.result().checksum).toBe(straight.result().checksum);

        seeking.seek(20);
        finishSeek(seeking);
        again.advance(20);
        expect(seeking.tickCount).toBe(20);
        expect(seeking.result().checksum).toBe(again.result().checksum);
      } finally {
        [straight, seeking, again].forEach((run) => run.dispose());
      }
    });
  });
});
