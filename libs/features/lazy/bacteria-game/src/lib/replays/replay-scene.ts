import { arenaContent, SeatColors } from '../arena/arena-content';
import type { GlArenaPainter } from '../arena/gl/gl-arena-painter';
import type { ArenaContent, ArenaScene } from '../arena/arena-view.component';
import { computerLook, seatLooks } from '../state/colony-looks';
import type { Rect } from '../state/maps';
import { getLevel, levelMap } from '../state/levels';
import type { MatchEngine } from '../state/match-engine';
import { replayEngine, type Replay } from '../state/replay';
import type { Simulation } from '../state/simulation';
import type { BacteriaLook } from '../state/skins';

/**
 * How long a frame may spend playing on towards where the viewer seeks:
 * the view stays responsive and shows the match racing ahead.
 */
export const SEEK_FRAME_MS = 30;

/** A GL painter, as far as a `gpu-int` replay runs on its GPU. */
export type GpuIntPainter = Pick<GlArenaPainter, 'createSimulation'>;

/** A replay's engine, and the painter whose GPU it runs on - null: CPU. */
interface Built {
  engine: MatchEngine;
  gpu: GpuIntPainter | null;
}

/**
 * The replay's engine - null for one that does not play back here. A
 * `gpu-int` replay runs on `gpu`'s integer passes (ADR 0015), the same war
 * as `IntSimulation`, much faster. A GPU that fails to set up - in the
 * painter, sizing its targets, or in the engine's own setup - is let go
 * of, and the replay plays on `IntSimulation`, as a live match falls back
 * (`PlayerService`).
 */
function engineOf(replay: Replay, gpu: GpuIntPainter | null): Built | null {
  if (gpu === null || replay.header.simulation !== 'gpu-int') {
    const engine = replayEngine(replay);
    return engine && { engine, gpu: null };
  }
  const { width, height } = replay.header;
  const made: Simulation[] = [];
  try {
    const engine = replayEngine(replay, undefined, (balance, random, seed) => {
      const simulation = gpu.createSimulation(balance, random, {
        deterministic: true,
        matchSeed: seed,
      });
      made.push(simulation);
      // Sized now, so that a GPU failing to set up throws here, not on
      // the first tick.
      simulation.resize(width, height);
      return simulation;
    });
    return engine && { engine, gpu };
  } catch (error) {
    made.forEach((simulation) => simulation.dispose());
    console.warn('The replay falls back to the CPU', error);
    return engineOf(replay, null);
  }
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
  /** The painter whose GPU the war runs on - null on the CPU. */
  private gpu: GpuIntPainter | null;
  /** A painter whose GPU failed to set up, not asked again. */
  private refused: GpuIntPainter | null = null;
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
   * `gpu` plays a `gpu-int` replay on that painter's GPU, not the CPU.
   */
  public static of(
    replay: Replay,
    look: ReplayLook,
    gpu: GpuIntPainter | null = null
  ): ReplayScene | null {
    const built = engineOf(replay, gpu);
    return built && new ReplayScene(replay, look, built, gpu);
  }

  private constructor(
    public readonly replay: Replay,
    /** How it is drawn - a new look takes effect on the next frame. */
    public look: ReplayLook,
    built: Built,
    asked: GpuIntPainter | null
  ) {
    this.engine = built.engine;
    this.gpu = built.gpu;
    this.noteRefusal(built, asked);
    const { levelId, width, height } = replay.header;
    this.walls = levelMap(getLevel(levelId)).createWalls(width, height);
    this.computer = computerLook(levelId);
  }

  /** The ticks played so far. */
  public get tick(): number {
    return this.engine.tickCount;
  }

  /** Where the view is going: a seek's tick while one is under way. */
  public get shownTick(): number {
    return this.target ?? this.engine.tickCount;
  }

  /** True once the match played to its end - its outcome, or its last tick. */
  public get over(): boolean {
    return this.ended;
  }

  /** True while the war runs on the GPU, in the GL painter's context. */
  public get onGpu(): boolean {
    return this.gpu !== null;
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
    if (this.disposed) {
      return;
    }
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

  /** The match from its first tick again - none once disposed. */
  public restart(): void {
    this.rebuild(this.gpu);
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
    this.rebuild(gpu);
    if (at > 0) {
      this.seek(at);
    }
  }

  private rebuild(gpu: GpuIntPainter | null): void {
    if (this.disposed) {
      return;
    }
    this.engine.dispose();
    const built = engineOf(this.replay, gpu);
    if (built === null) {
      return;
    }
    this.engine = built.engine;
    this.gpu = built.gpu;
    this.noteRefusal(built, gpu);
    this.ended = false;
    this.target = null;
  }

  private noteRefusal(built: Built, asked: GpuIntPainter | null): void {
    if (asked !== null && built.gpu === null) {
      this.refused = asked;
    }
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
