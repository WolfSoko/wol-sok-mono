import { effect, Signal, signal, WritableSignal } from '@angular/core';
import { clamp } from './clamp';
import {
  GravityWorldConfig,
  INITIAL_SIMULATION_SPEED,
  MAX_SIMULATION_SPEED,
  MIN_SIMULATION_SPEED,
} from './gravity-world-config';
import { MAX_TICK_YEARS, MAX_TICKS_PER_FRAME } from './gravity-world.service';

/**
 * World time one second of watching is worth, in years. A tenth takes the
 * earth ten seconds to go round the sun at the usual speed - slow enough to
 * follow, fast enough not to wait for mars.
 */
export const YEARS_PER_SECOND = 0.1;

/** What the runner has to ask the world it keeps moving. */
export interface SimulationRunnerWorld {
  settings: Signal<GravityWorldConfig>;
  /** Moves the world on by `years`, keeping `trailLength` trail points. */
  advance(years: number, trailLength: number): void;
  /** Called after every step, once the bodies have moved. */
  afterStep(): void;
}

/**
 * The clock of the world: whether it runs, and how far one animation frame
 * takes it. Start, pause, and the pause a settings panel asks for, which is
 * owed its restart when the panel closes.
 *
 * Has to be created in an injection context: the frame loop is started by an
 * effect on `running`.
 */
export class SimulationRunner {
  public readonly running: WritableSignal<boolean> = signal(false);

  /** Whether the world was running when something paused it for a while. */
  private suspended = false;

  public constructor(private readonly world: SimulationRunnerWorld) {
    effect(() => (this.running() ? this.loop() : null));
  }

  public stop(): void {
    this.running.set(false);
  }

  public toggle(): void {
    this.running.update((running) => !running);
    // set by hand now, so a resume must not set it back
    this.suspended = false;
  }

  /**
   * Pauses the world for a while, remembering whether it ran. A world already
   * suspended once stays owed its restart when suspended again.
   */
  public suspend(): void {
    this.suspended = this.suspended || this.running();
    this.stop();
  }

  /** Picks the world back up, if a `suspend` stopped it. */
  public resume(): void {
    if (this.suspended) {
      this.suspended = false;
      this.running.set(true);
    }
  }

  /** Stops the world and forgets any restart it was owed. */
  public reset(): void {
    this.stop();
    this.suspended = false;
  }

  /**
   * Advances the simulation by a single frame of the given length. How much
   * world time that frame is worth is what the simulation speed decides; how
   * that time is safely integrated is the world's own business.
   */
  public step(deltaTime: number): void {
    const { showTrail, trailLength, simulationSpeed } = this.world.settings();
    // the config is an injection token, so a speed can be missing entirely
    const speed: number = clamp(
      simulationSpeed > 0 ? simulationSpeed : INITIAL_SIMULATION_SPEED,
      MIN_SIMULATION_SPEED,
      MAX_SIMULATION_SPEED
    );
    // a frame the tab slept through would otherwise arrive as one enormous
    // slice per tick: that time is dropped instead, which costs the world a
    // moment of its history, where a planet thrown out of its orbit is gone
    // for good
    const years: number = Math.min(
      deltaTime * speed * YEARS_PER_SECOND,
      MAX_TICKS_PER_FRAME * MAX_TICK_YEARS
    );
    this.world.advance(years, showTrail ? trailLength : 0);
    this.world.afterStep();
  }

  /** Advances the simulation once per animation frame while it is running. */
  private loop(lastFrameTime?: number): void {
    requestAnimationFrame((time) => {
      if (!this.running()) {
        return;
      }
      const deltaTime: number = lastFrameTime
        ? (time - lastFrameTime) / 1000
        : 1 / 120;
      this.step(deltaTime);
      this.loop(time);
    });
  }
}
