import { matchChecksum } from './checksum';
import type { MatchEngine } from './match-engine';
import type { Player } from './player.model';
import type { MatchOutcome } from './win-conditions';

/** The arena a match is ticked in - the same size on every tick. */
export interface MatchArena {
  width: number;
  height: number;
}

/** What a {@link MatchRun} needs of its engine. */
export type RunnableEngine = Pick<
  MatchEngine,
  'tick' | 'outcome' | 'tickCount' | 'players' | 'dispose'
>;

/** Where a match run stands - a replay's result without its samples. */
export interface MatchRunResult {
  players: readonly Player[];
  /** How it ended - null when it stopped at its last tick before an outcome. */
  outcome: MatchOutcome | null;
  ticks: number;
  /** The {@link matchChecksum} after the last tick played. */
  checksum: number;
}

/**
 * Plays a match on to its end: an outcome, or its last tick. It knows the
 * arena every tick takes, the tick budget, how far a frame may play, how to
 * seek - forwards by playing on, back by building the engine anew from its
 * first tick, as a deterministic war plays forwards only - and the result
 * with its checksum. Its callers write no tick loop of their own.
 */
export class MatchRun<E extends RunnableEngine = MatchEngine> {
  private current: E;
  /** The engine's outcome, judged once a tick - only a tick changes it. */
  private outcome: MatchOutcome | null;
  /** The tick a seek plays on towards - null while none is under way. */
  private target: number | null = null;
  private disposed = false;

  /**
   * `build` makes the engine at its first tick - again for every seek back.
   * `lastTick` is the tick the match is cut off at without an outcome.
   */
  public constructor(
    private readonly build: () => E,
    private readonly arena: MatchArena,
    public readonly lastTick: number
  ) {
    this.current = build();
    this.outcome = this.current.outcome();
  }

  /** The engine the match runs on - a new one after a seek back. */
  public get engine(): E {
    return this.current;
  }

  /** The ticks played so far. */
  public get tickCount(): number {
    return this.current.tickCount;
  }

  /** True once the match is over: its outcome, or its last tick. */
  public get over(): boolean {
    return this.outcome !== null || this.current.tickCount >= this.lastTick;
  }

  /** True while a seek plays on towards its tick. */
  public get seeking(): boolean {
    return this.target !== null;
  }

  /** Where the run is going: a seek's tick while one is under way. */
  public get shownTick(): number {
    return this.target ?? this.current.tickCount;
  }

  /**
   * Plays up to `maxTicks` ticks - none once the match is over or the run
   * disposed. While a seek is under way it plays on towards the seek's tick
   * instead. `deadline` is asked after every tick and stops the frame once
   * it says true: at least one tick is played. Gives the ticks played.
   */
  public advance(maxTicks: number, deadline?: () => boolean): number {
    if (this.disposed) {
      return 0;
    }
    const until = this.target ?? this.current.tickCount + maxTicks;
    let played = 0;
    while (!this.over && this.current.tickCount < until) {
      this.current.tick(this.arena.width, this.arena.height);
      this.outcome = this.current.outcome();
      played++;
      if (deadline?.() === true) {
        return played;
      }
    }
    this.target = null;
    return played;
  }

  /**
   * Goes to that tick, between the first and the last: back means a new
   * engine from the first tick, and the following calls of
   * {@link advance} play on to it - a tick already reached is there on the
   * next call.
   */
  public seek(tick: number): void {
    if (this.disposed) {
      return;
    }
    const target = Math.max(0, Math.min(Math.round(tick), this.lastTick));
    if (target < this.current.tickCount) {
      this.rebuild();
    }
    this.target = target;
  }

  /** The match from its first tick again, on a new engine - none once disposed. */
  public restart(): void {
    if (!this.disposed) {
      this.rebuild();
      this.target = null;
    }
  }

  /** Where the match stands now. */
  public result(): MatchRunResult {
    const { players, tickCount } = this.current;
    return {
      players,
      outcome: this.outcome,
      ticks: tickCount,
      checksum: matchChecksum(players),
    };
  }

  /**
   * A new engine from the first tick. The old one goes first, so two never
   * hold a GPU's memory at once; a build that throws ends the run.
   */
  private rebuild(): void {
    this.disposed = true;
    this.current.dispose();
    this.current = this.build();
    this.outcome = this.current.outcome();
    this.disposed = false;
  }

  /** Lets go of the engine - once is enough; the run plays no more. */
  public dispose(): void {
    if (!this.disposed) {
      this.disposed = true;
      this.current.dispose();
    }
  }
}
