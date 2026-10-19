import { Injectable, inject } from '@angular/core';
import { transaction } from '@datorama/akita';
import { Nutrient } from './bacteria-simulation';
import { Simulation, SimulationFactory } from './simulation';
import { GameBalance } from './game-balance';
import { GameStateQuery } from './game-state.query';
import { isSteering, Point, randomSeed, SteeringVector } from './geometry';
import { DynamicWall } from './maps';
import {
  cpuSimulation,
  FrameEvents,
  MatchEngine,
  MatchOptions,
  MatchOutcome,
  noFrameEvents,
  PlayerSpawn,
} from './match-engine';
import { Player } from './player.model';
import { PlayerStore } from './player.store';
import { ReplayInputs } from './replay';

export type { FrameEvents, PlayerSpawn } from './match-engine';

/**
 * The keys that steer a crosshair, one set per human player: WASD for the
 * first one, the arrow keys for the second one. Each key asks for one axis
 * at -1 or 1; the keys and the joystick of a player are summed, and the
 * engine caps the sum at unit length.
 */
const KEY_SETS: readonly Record<string, SteeringVector>[] = [
  {
    w: { x: 0, y: -1 },
    s: { x: 0, y: 1 },
    a: { x: -1, y: 0 },
    d: { x: 1, y: 0 },
  },
  {
    arrowup: { x: 0, y: -1 },
    arrowdown: { x: 0, y: 1 },
    arrowleft: { x: -1, y: 0 },
    arrowright: { x: 1, y: 0 },
  },
];

/**
 * Runs the match of the page: a {@link MatchEngine} whose players are
 * mirrored into the player store after every change, for the scoreboard and
 * the rest of the UI.
 */
@Injectable({ providedIn: 'root' })
export class PlayerService {
  private playerStore = inject(PlayerStore);
  private gameStateQuery = inject(GameStateQuery);

  /** Builds each match's simulation - on the CPU unless told otherwise. */
  private simulationFactory: SimulationFactory = cpuSimulation;
  private engine = new MatchEngine([], { seed: 0 });
  /** Where each player's joystick is pushed right now, absent while at rest. */
  private sticks = new Map<number, SteeringVector>();
  /** The players last mirrored into the store. */
  private mirrored: readonly Player[] = [];
  /** What the last frame did, for the sound. */
  private frameEvents: FrameEvents = noFrameEvents();

  /**
   * Starts a fresh match: new players in the store, new colonies in the
   * simulation.
   *
   * The level decides the wall layout and the balance, so the simulation is
   * rebuilt with them - its balance is fixed for the lifetime of a match on
   * purpose, nothing may change the rules while the colonies are fighting.
   */
  @transaction()
  public init(
    spawns: PlayerSpawn[],
    options: Omit<MatchOptions, 'seed' | 'simulation' | 'replay'> & {
      /** Where every chance of the match comes from - a fresh one when absent. */
      seed?: number;
    } = {}
  ): void {
    const { arena, ...rules } = options;
    this.engine.dispose();
    this.engine = new MatchEngine(spawns, {
      ...rules,
      seed: options.seed ?? randomSeed(),
      // Sized in there, where the GPU may still fail and leave it to the CPU.
      simulation: (balance, random) =>
        this.createSimulation(balance, random, arena),
    });
    this.sticks.clear();
    this.frameEvents = noFrameEvents();
    this.mirrored = this.engine.players;
    this.playerStore.set(this.mirrored.slice());
    this.playerStore.setActive(0);
  }

  /** See {@link MatchEngine.setDragTarget}. */
  public setDragTarget(playerId: number, x: number, y: number): void {
    this.engine.setDragTarget(playerId, x, y);
  }

  /**
   * Pushes a player's joystick, for the on-screen sticks of the touch layout.
   * The stick works like a held key, added to the keys - see
   * {@link MatchEngine.setSteering}.
   */
  public setSteering(playerId: number, vector: SteeringVector): void {
    if (isSteering(vector)) {
      this.sticks.set(playerId, vector);
    } else {
      this.sticks.delete(playerId);
    }
  }

  /** See {@link MatchEngine.boost}. */
  public boost(playerId: number): void {
    if (this.engine.boost(playerId)) {
      this.mirror();
    }
  }

  /**
   * Advances the whole colony war by one tick: the crosshairs, the boosts,
   * the bots and the war.
   */
  public tick(width: number, height: number): void {
    this.steerHumans(this.gameStateQuery.getValue().keysPressed);
    this.engine.tick(width, height);
    this.mirror();
  }

  /**
   * Closes a display frame: what its ticks did, and the boosts fired since
   * the last one, become the frame's events.
   */
  public endFrame(): void {
    this.frameEvents = this.engine.takeFrameEvents();
  }

  /** What happened during the ticks of the last frame - used for the sound only. */
  public getFrameEvents(): FrameEvents {
    return this.frameEvents;
  }

  /** See {@link MatchEngine.crosshairAt}. */
  public crosshairAt(player: Player, alpha: number): Point {
    const { width, height } = this.gameStateQuery.getValue();
    return this.engine.crosshairAt(player, alpha, width, height);
  }

  /** How the match ended, null while it is still on. */
  public outcome(): MatchOutcome | null {
    return this.engine.outcome();
  }

  /** Ticks the match has run. */
  public get tickCount(): number {
    return this.engine.tickCount;
  }

  /** What the humans did in the match, for its replay. */
  public get recorded(): ReplayInputs {
    return this.engine.recorded;
  }

  /** The nutrient pellets currently on the map - used for rendering only. */
  public getNutrients(): Nutrient[] {
    return this.engine.simulation.getNutrients();
  }

  /** The gates and sliding walls as they stand - used for rendering only. */
  public getDynamicWalls(): readonly DynamicWall[] {
    return this.engine.simulation.getDynamicWalls();
  }

  /** The simulation of the current match - used for rendering only. */
  public getSimulation(): Simulation {
    return this.engine.simulation;
  }

  /**
   * Runs the matches from now on with simulations from this factory - the
   * GPU one once the arena has a WebGL2 context, the CPU one again for null.
   * Takes effect with the next match.
   */
  public useSimulation(factory: SimulationFactory | null): void {
    this.simulationFactory = factory ?? cpuSimulation;
    if (factory == null && this.engine.simulation.kind === 'gpu') {
      // It may hold a context that is going away: let it go now.
      this.engine.dispose();
      this.engine = new MatchEngine([], { seed: 0 });
    }
  }

  /**
   * A simulation from the factory, sized to the arena. Should the GPU turn
   * out not to run it - a shader its driver rejects, a format it cannot
   * render into - the CPU takes over, for this match and the next ones.
   */
  private createSimulation(
    balance: GameBalance,
    random: () => number,
    arena?: { width: number; height: number }
  ): Simulation {
    let simulation: Simulation | null = null;
    try {
      simulation = this.simulationFactory(balance, random);
      if (arena != null) {
        simulation.resize(arena.width, arena.height);
      }
      return simulation;
    } catch (error) {
      // Let go of the context listeners, or a restored context revives it.
      simulation?.dispose();
      if (this.simulationFactory === cpuSimulation) {
        throw error;
      }
      console.warn('The colony war falls back to the CPU', error);
      this.simulationFactory = cpuSimulation;
      return this.createSimulation(balance, random, arena);
    }
  }

  /**
   * Turns the held keys and the pushed sticks into one steering vector per
   * human.
   *
   * Each key set belongs to one human player, in order. With a single human
   * every set steers that one crosshair, so against the computer WASD and the
   * arrow keys both work - and the keys never touch a bot's crosshair.
   */
  private steerHumans(keysPressed: readonly string[]): void {
    const humans = this.engine.players.filter((player) => !player.isBot);
    humans.forEach((human, index) => {
      const stick = this.sticks.get(human.id);
      const direction = { x: stick?.x ?? 0, y: stick?.y ?? 0 };
      KEY_SETS.forEach((keySet, setIndex) => {
        if (Math.min(setIndex, humans.length - 1) !== index) {
          return;
        }
        for (const key of keysPressed) {
          const step = keySet[key.toLowerCase()];
          if (step != null) {
            direction.x += step.x;
            direction.y += step.y;
          }
        }
      });
      this.engine.setSteering(human.id, direction);
    });
  }

  /** Mirrors the engine's players into the store, in one go, if they changed. */
  private mirror(): void {
    const players = this.engine.players;
    if (players !== this.mirrored) {
      this.mirrored = players;
      this.playerStore.upsertMany(players.slice());
    }
  }
}
