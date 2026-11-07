import { arenaContent, SeatColors } from '../arena/arena-content';
import type { GlArenaPainter } from '../arena/gl/gl-arena-painter';
import { gpuSimulationsOf } from '../gl/simulation-choice';
import type { ArenaContent, ArenaScene } from '../arena/arena-view.component';
import {
  type BacteriaLook,
  canPlayBack,
  computerLook,
  getLevel,
  levelMap,
  MatchRun,
  type Rect,
  type Replay,
  replayRun,
  seatLooks,
  type SimulationFactory,
} from '@wolsok/feat-shared-bacteria-engine';

/**
 * How long a frame may spend playing on towards where the viewer seeks:
 * the view stays responsive and shows the match racing ahead.
 */
export const SEEK_FRAME_MS = 30;

/** A GL painter, as far as a `gpu-int` replay runs on its GPU. */
export type GpuIntPainter = Pick<GlArenaPainter, 'createSimulation'>;

/**
 * The integer passes on `gpu`'s GPU for a `gpu-int` replay (ADR 0015), the
 * same war as `IntSimulation`, much faster - sized at once, so that a GPU
 * failing to set up throws while the engine is built, not on the first
 * tick, and `replayRun` falls back to the CPU.
 */
function gpuIntOn(gpu: GpuIntPainter, replay: Replay): SimulationFactory {
  const { width, height } = replay.header;
  const { int } = gpuSimulationsOf((balance, random, options) =>
    gpu.createSimulation(balance, random, options)
  );
  return (balance, random, seed) => {
    const simulation = int(balance, random, seed);
    try {
      simulation.resize(width, height);
    } catch (error) {
      // Not handed out yet, so let go of here.
      simulation.dispose();
      throw error;
    }
    return simulation;
  };
}

/** How a replay is drawn: the device's look and its wish for less motion. */
export interface ReplayLook {
  look: BacteriaLook;
  reducedMotion: boolean;
}

/**
 * A recorded match as an `ArenaView` plays it by itself (ADR 0011): a
 * `MatchRun` on its own engine from `replayEngine` - the humans played
 * back from the recording, the bot and the neutral colonies simulated
 * again from the seed, on the replay's ruleset - with nothing of the
 * game's state, its account or Firebase. The view calls {@link advance}
 * with the ticks of each frame and paints {@link content}.
 */
export class ReplayScene implements ArenaScene {
  private run: MatchRun;
  /** The painter whose GPU the war runs on - null on the CPU. */
  private gpu: GpuIntPainter | null = null;
  /** A painter whose GPU failed to set up, not asked again. */
  private refused: GpuIntPainter | null = null;
  private readonly walls: readonly Rect[];
  /** The look the computer wears on the replay's level. */
  private readonly computer: BacteriaLook;
  private readonly seatColors = new SeatColors();
  private disposed = false;

  /**
   * Builds the scene - null for a replay that does not play back here.
   * `gpu` plays a `gpu-int` replay on that painter's GPU, not the CPU.
   */
  public static of(
    replay: Replay,
    look: ReplayLook,
    gpu: GpuIntPainter | null = null
  ): ReplayScene | null {
    return canPlayBack(replay) ? new ReplayScene(replay, look, gpu) : null;
  }

  private constructor(
    public readonly replay: Replay,
    /** How it is drawn - a new look takes effect on the next frame. */
    public look: ReplayLook,
    gpu: GpuIntPainter | null
  ) {
    this.run = this.runOn(gpu);
    const { levelId, width, height } = replay.header;
    this.walls = levelMap(getLevel(levelId)).createWalls(width, height);
    this.computer = computerLook(levelId);
  }

  /** The ticks played so far. */
  public get tick(): number {
    return this.run.tickCount;
  }

  /** Where the view is going: a seek's tick while one is under way. */
  public get shownTick(): number {
    return this.run.shownTick;
  }

  /** True once the match played to its end - its outcome, or its last tick. */
  public get over(): boolean {
    return this.run.over;
  }

  /** True while the war runs on the GPU, in the GL painter's context. */
  public get onGpu(): boolean {
    return this.gpu !== null;
  }

  /** True while a seek plays on towards its tick. */
  public get seeking(): boolean {
    return this.run.seeking;
  }

  /**
   * Plays up to `ticks` ticks of the match - none once it is over. While a
   * seek is under way it plays on towards its tick instead, as far as
   * {@link SEEK_FRAME_MS} allows.
   */
  public advance(ticks: number): void {
    if (!this.run.seeking) {
      this.run.advance(ticks);
      return;
    }
    const deadline = performance.now() + SEEK_FRAME_MS;
    this.run.advance(ticks, () => performance.now() >= deadline);
  }

  /**
   * Goes to that tick of the match. A deterministic war plays forwards
   * only: back means from the first tick again, and the following frames
   * ({@link advance}) play on to the tick, fast - a tick already reached
   * shows on the next frame.
   */
  public seek(tick: number): void {
    this.run.seek(tick);
  }

  /** The match from its first tick again - none once disposed. */
  public restart(): void {
    this.run.restart();
  }

  /**
   * Runs a `gpu-int` replay on that painter's GPU from now on, or on the
   * CPU with null - the painter came, or its context goes. It goes on
   * where it was: the new war plays on to that tick. A GPU that failed
   * once is not asked again.
   */
  public useGpu(painter: GpuIntPainter | null): void {
    const gpu =
      this.replay.header.simulation === 'gpu-int' && painter !== this.refused
        ? painter
        : null;
    if (this.disposed || gpu === this.gpu) {
      return;
    }
    const at = this.shownTick;
    this.run.dispose();
    this.run = this.runOn(gpu);
    if (at > 0) {
      this.seek(at);
    }
  }

  /**
   * A run from the first tick, on `gpu` for a `gpu-int` replay - on the
   * CPU from the moment the GPU fails to set up.
   */
  private runOn(gpu: GpuIntPainter | null): MatchRun {
    const onGpu = gpu !== null && this.replay.header.simulation === 'gpu-int';
    this.gpu = onGpu ? gpu : null;
    const run = replayRun(this.replay, {
      ...(onGpu ? { gpuInt: gpuIntOn(gpu, this.replay) } : {}),
      // The engine warned already.
      onGpuFailure: () => {
        this.refused = gpu;
        this.gpu = null;
      },
    });
    if (run === null) {
      throw new Error('The replay does not play back');
    }
    return run;
  }

  public content(alpha: number): ArenaContent {
    const { engine } = this.run;
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
      this.run.dispose();
    }
  }
}
