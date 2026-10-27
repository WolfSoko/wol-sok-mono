import { arenaContent, SeatColors } from '../arena/arena-content';
import type { GlArenaPainter } from '../arena/gl/gl-arena-painter';
import type { ArenaContent, ArenaScene } from '../arena/arena-view.component';
import { computerLook, seatLooks } from '../state/colony-looks';
import { intSimulation } from '../state/gpu-int/int-simulation';
import type { Rect } from '../state/maps';
import { getLevel, levelMap } from '../state/levels';
import type { MatchEngine } from '../state/match-engine';
import { replayEngine, type Replay } from '../state/replay';
import type { Simulation, SimulationFactory } from '../state/simulation';
import type { BacteriaLook } from '../state/skins';

/**
 * How long a frame may spend playing on towards where the viewer seeks:
 * the view stays responsive and shows the match racing ahead.
 */
export const SEEK_FRAME_MS = 30;

/**
 * The integer passes on a GL painter's GPU for a `gpu-int` replay of that
 * size (ADR 0015): the same war as `IntSimulation`, much faster. Should the
 * GPU fail to set up, the replay plays on `IntSimulation` after all, as a
 * live match does (`PlayerService`) - which is why it is sized here, where
 * a failing setup can still be caught, not first in `MatchEngine`.
 */
export function gpuIntReplaySimulation(
  painter: Pick<GlArenaPainter, 'createSimulation'>,
  width: number,
  height: number
): SimulationFactory {
  return (balance, random, seed) => {
    let simulation: Simulation | undefined;
    try {
      simulation = painter.createSimulation(balance, random, {
        deterministic: true,
        matchSeed: seed,
      });
      simulation.resize(width, height);
      return simulation;
    } catch (error) {
      simulation?.dispose();
      console.warn('The replay falls back to the CPU', error);
      return intSimulation(balance, random, seed);
    }
  };
}

/** How a replay is drawn: the device's look and its wish for less motion. */
export interface ReplayLook {
  look: BacteriaLook;
  reducedMotion: boolean;
}

/**
 * A recorded match as an `ArenaView` plays it by itself (ADR 0011): its
 * own `MatchEngine` from `replayEngine` - the humans played back from the
 * recording, the bot and the neutral colonies simulated again from the
 * seed, on the replay's ruleset - with nothing of the game's state, its
 * account or Firebase. The view calls {@link advance} with the ticks of
 * each frame and paints {@link content}.
 */
export class ReplayScene implements ArenaScene {
  private engine: MatchEngine;
  private readonly walls: readonly Rect[];
  /** The look the computer wears on the replay's level. */
  private readonly computer: BacteriaLook;
  private readonly seatColors = new SeatColors();
  private ended = false;
  private disposed = false;
  /** The tick a seek plays on towards - null while none is under way. */
  private target: number | null = null;

  /**
   * Builds the scene - null for a replay that does not play back here.
   * `gpuInt` plays a `gpu-int` replay on the GPU instead of the CPU.
   */
  public static of(
    replay: Replay,
    look: ReplayLook,
    gpuInt?: SimulationFactory
  ): ReplayScene | null {
    const engine = replayEngine(replay, undefined, gpuInt);
    return engine === null
      ? null
      : new ReplayScene(replay, look, engine, gpuInt);
  }

  private constructor(
    public readonly replay: Replay,
    private readonly look: ReplayLook,
    engine: MatchEngine,
    private readonly gpuInt: SimulationFactory | undefined
  ) {
    this.engine = engine;
    const { levelId, width, height } = replay.header;
    this.walls = levelMap(getLevel(levelId)).createWalls(width, height);
    this.computer = computerLook(levelId);
  }

  /** The ticks played so far. */
  public get tick(): number {
    return this.engine.tickCount;
  }

  /** True once the match played to its end - its outcome, or its last tick. */
  public get over(): boolean {
    return this.ended;
  }

  /** True while the war runs on the GPU, in the GL painter's context. */
  public get onGpu(): boolean {
    return this.engine.simulation.kind === 'gpu';
  }

  /** True while a seek plays on towards its tick. */
  public get seeking(): boolean {
    return this.target !== null;
  }

  /**
   * Plays up to `ticks` ticks of the match - none once it is over. While a
   * seek is under way it plays on towards its tick instead, as far as
   * {@link SEEK_FRAME_MS} allows.
   */
  public advance(ticks: number): void {
    if (this.target !== null) {
      this.playTowardsTarget();
      return;
    }
    for (let played = 0; played < ticks && !this.ended; played++) {
      this.step();
    }
  }

  /**
   * Goes to that tick of the match. A deterministic war plays forwards
   * only: back means from the first tick again, and the following frames
   * ({@link advance}) play on to the tick, fast - a tick already reached
   * shows on the next frame.
   */
  public seek(tick: number): void {
    const target = Math.max(
      0,
      Math.min(Math.round(tick), this.replay.header.ticks)
    );
    if (target < this.engine.tickCount) {
      this.restart();
    }
    this.target = target;
  }

  /** The match from its first tick again. */
  public restart(): void {
    const engine = replayEngine(this.replay, undefined, this.gpuInt);
    if (engine === null) {
      return;
    }
    this.engine.dispose();
    this.engine = engine;
    this.ended = false;
    this.target = null;
  }

  private playTowardsTarget(): void {
    const deadline = performance.now() + SEEK_FRAME_MS;
    while (
      this.target !== null &&
      !this.ended &&
      this.engine.tickCount < this.target
    ) {
      this.step();
      if (performance.now() >= deadline) {
        return;
      }
    }
    this.target = null;
  }

  private step(): void {
    const { width, height, ticks: last } = this.replay.header;
    this.engine.tick(width, height);
    this.ended =
      this.engine.outcome() !== null || this.engine.tickCount >= last;
  }

  public content(alpha: number): ArenaContent {
    const { engine } = this;
    const { width, height } = this.replay.header;
    return arenaContent({
      players: engine.players,
      crosshairAt: (player) => engine.crosshairAt(player, alpha, width, height),
      simulation: engine.simulation,
      walls: this.walls,
      // The level's balance at the replay's scale, as `planMatch` made it.
      balance: engine.balance,
      looks: seatLooks(engine.players, this.look.look, this.computer),
      reducedMotion: this.look.reducedMotion,
      weaponFires: engine.takeFrameEvents().weapons,
      seatColors: this.seatColors,
    });
  }

  /**
   * Lets go of the engine - the view is done with the scene, or its GL
   * context goes. Once is enough.
   */
  public dispose(): void {
    if (!this.disposed) {
      this.disposed = true;
      this.engine.dispose();
    }
  }
}
