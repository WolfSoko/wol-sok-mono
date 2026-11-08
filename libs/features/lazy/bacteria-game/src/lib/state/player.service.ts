import {
  type ActiveEffect,
  CPU_SIMULATIONS,
  createSimulationProvider,
  DynamicWall,
  FrameEvents,
  isSteering,
  MatchEngine,
  MatchOptions,
  MatchOutcome,
  noFrameEvents,
  Nutrient,
  Player,
  PlayerSpawn,
  Point,
  randomSeed,
  ReplayInputs,
  Ruleset,
  Simulation,
  SimulationProvider,
  SimulationRequest,
  SteeringVector,
} from '@wolsok/feat-shared-bacteria-engine';
import { Injectable, inject, signal, untracked } from '@angular/core';
import { GameStateStore } from './game.states';
import { PlayerStore } from './player.store';
import { injectGameAnalytics } from '../analytics/game-analytics';
import type { Lockstep } from '../net/lockstep';
import type { DeviceSimulations } from '../gl/simulation-choice';

export type {
  FrameEvents,
  PlayerSpawn,
} from '@wolsok/feat-shared-bacteria-engine';

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
  private gameStateStore = inject(GameStateStore);
  private readonly analytics = injectGameAnalytics();

  /** Which simulation plays each match, and what stands in for the GPU. */
  private simulations: SimulationProvider = CPU_SIMULATIONS;
  /** Mirrors `simulations.gpuIntReady()`, for the views and the ranking. */
  private readonly gpuIntOnGpu = signal(false);

  /**
   * True while this device has the integer GPU passes to play a `gpu-int`
   * match on - a WebGL2 arena whose GPU has not failed to start them. A
   * ranked match plays them (ADR 0012, 0015); whether the GPU is trusted
   * is the self-test's word, not this.
   */
  public readonly gpuIntReady = this.gpuIntOnGpu.asReadonly();
  private engine = new MatchEngine([], { seed: 0 });
  /** Where each player's joystick is pushed right now, absent while at rest. */
  private sticks = new Map<number, SteeringVector>();
  /** The players last mirrored into the store. */
  private mirrored: readonly Player[] = [];
  /** What the last frame did, for the sound. */
  private frameEvents: FrameEvents = noFrameEvents();
  /** The lockstep of an online match, null in any other. */
  private lockstep: Lockstep | null = null;
  /** Where the player at this device sent the crosshair since the last tick. */
  private localDrag: Point | null = null;
  /** True when the player at this device fired the boost since the last tick. */
  private localBoost = false;

  /**
   * Starts a fresh match: new players in the store, new colonies in the
   * simulation.
   *
   * The level decides the wall layout and the balance, so the simulation is
   * rebuilt with them - its balance is fixed for the lifetime of a match on
   * purpose, nothing may change the rules while the colonies are fighting.
   *
   * An online match runs on the `ruleset` both devices agreed on, a
   * simulation they play alike, and its ticks wait for the `lockstep`. A
   * local match given a `ruleset` - a ranked one, `gpu-int` - plays it the
   * same way: on the integer GPU passes, `intSimulation` standing in only
   * should the GPU fail to start. A
   * match with `recordedSeats` runs on a ruleset too, one a recording plays
   * back on as it was played (ADR 0011, 0015): the device's, where that is
   * one, the CPU's else. Which simulation plays it is the provider's
   * answer - see {@link useSimulations}.
   */
  public init(
    spawns: PlayerSpawn[],
    options: Omit<MatchOptions, 'seed' | 'simulation'> & {
      /** Where every chance of the match comes from - a fresh one when absent. */
      seed?: number;
      /** The lockstep with the other device of an online match. */
      lockstep?: Lockstep;
      /**
       * The ruleset both devices of an online match agreed on - `cpu` when
       * absent - or the one a local match must play: a ranked match's.
       */
      ruleset?: Ruleset;
    } = {}
  ): void {
    const { arena, lockstep, ruleset, ...rules } = options;
    this.engine.dispose();
    this.lockstep = lockstep ?? null;
    this.engine = new MatchEngine(spawns, {
      ...rules,
      seed: options.seed ?? randomSeed(),
      // Sized in there, where the GPU may still fail and leave it to the CPU.
      simulation: this.simulations.simulationFor(
        this.requestOf(lockstep, ruleset, rules.recordedSeats),
        arena
      ),
    });
    this.localDrag = null;
    this.localBoost = false;
    this.sticks.clear();
    this.frameEvents = noFrameEvents();
    this.mirrored = this.engine.players;
    this.playerStore.setPlayers(this.mirrored);
    this.playerStore.setNeutralCount(this.engine.neutralCount);
  }

  /** See {@link MatchEngine.setDragTarget}. */
  public setDragTarget(playerId: number, x: number, y: number): void {
    if (this.lockstep?.localSeat === playerId) {
      this.localDrag = { x, y };
      return;
    }
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

  /**
   * See {@link MatchEngine.boost}. Online, the boost goes out with the next
   * tick's input, and fires when the lockstep plays it.
   */
  public boost(playerId: number): void {
    if (this.lockstep?.localSeat === playerId) {
      this.localBoost = true;
      return;
    }
    if (this.engine.boost(playerId)) {
      this.mirror();
    }
  }

  /**
   * See {@link MatchEngine.fireWeapon}. Online matches carry no weapons -
   * and the lockstep plays every seat, so the engine fires none anyway.
   */
  public fireWeapon(playerId: number): void {
    if (this.engine.fireWeapon(playerId)) {
      this.mirror();
    }
  }

  /** The weapons' effects acting on the war now. */
  public getActiveEffects(): readonly ActiveEffect[] {
    return this.engine.simulation.getActiveEffects();
  }

  /**
   * Advances the whole colony war by one tick: the crosshairs, the boosts,
   * the bots and the war.
   */
  public tick(width: number, height: number): void {
    const keys = untracked(this.gameStateStore.keysPressed);
    const { lockstep } = this;
    if (lockstep === null) {
      this.steerHumans(keys);
      this.engine.tick(width, height);
    } else {
      lockstep.putLocal(
        this.engine.tickCount,
        this.steering(lockstep.localSeat, keys),
        this.localDrag,
        this.localBoost
      );
      this.localDrag = null;
      this.localBoost = false;
      this.engine.tick(width, height);
      lockstep.ticked(this.engine.tickCount, this.engine.players);
    }
    this.mirror();
  }

  /**
   * True when the next tick may be played: always, but in an online match
   * only once the other device's input for it is in.
   */
  public canTick(): boolean {
    return this.lockstep?.ready(this.engine.tickCount) ?? true;
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
    return this.engine.crosshairAt(
      player,
      alpha,
      untracked(this.gameStateStore.width),
      untracked(this.gameStateStore.height)
    );
  }

  /** How the match ended, null while it is still on. */
  public outcome(): MatchOutcome | null {
    return this.engine.outcome();
  }

  /** True once the two devices of an online match played different matches. */
  public get desynced(): boolean {
    return this.lockstep?.desynced ?? false;
  }

  /** Ticks the match has run. */
  public get tickCount(): number {
    return this.engine.tickCount;
  }

  /** The players as the engine has them after the last tick - for the checksum. */
  public get players(): readonly Player[] {
    return this.engine.players;
  }

  /** What the humans did in the match, for its replay. */
  public get recorded(): ReplayInputs {
    return this.engine.recorded;
  }

  /** The ruleset the match plays by - null on the float GPU. */
  public get ruleset(): Ruleset | null {
    return this.engine.simulation.ruleset;
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
   * Runs the matches from now on on these simulations - the GPU's once the
   * arena has a WebGL2 context, the CPU's again for null. Takes effect with
   * the next match. Should the GPU fail to start, the provider steps down
   * to the CPU for this match and the next ones (see
   * `createSimulationProvider`), and the device offers `cpu` only.
   */
  public useSimulations(sources: DeviceSimulations | null): void {
    this.simulations =
      sources === null
        ? CPU_SIMULATIONS
        : createSimulationProvider({
            ...sources,
            onFallback: () => {
              this.analytics.track('simulation_fallback');
              this.gpuIntOnGpu.set(false);
            },
          });
    this.gpuIntOnGpu.set(this.simulations.gpuIntReady());
    if (sources === null && this.engine.simulation.kind === 'gpu') {
      // It may hold a context that is going away: let it go now.
      this.engine.dispose();
      this.engine = new MatchEngine([], { seed: 0 });
    }
  }

  /** The rulesets this device can play an online match on, `cpu` always. */
  public rulesetOffers(): readonly Ruleset[] {
    return this.simulations.offers();
  }

  /**
   * What a match asks the simulations for: the ruleset both devices of an
   * online match agreed on (`cpu` when none was) or a ranked match's; a
   * recorded local match plays the device's ruleset, a recording plays
   * back on as it was played (ADR 0011, 0015) - the CPU's for the float
   * GPU; any other match plays what the device plays.
   */
  private requestOf(
    lockstep: Lockstep | undefined,
    ruleset: Ruleset | undefined,
    recordedSeats: ReadonlySet<number> | undefined
  ): SimulationRequest {
    if (lockstep !== undefined || ruleset !== undefined) {
      return ruleset ?? 'cpu';
    }
    if (recordedSeats !== undefined) {
      return this.simulations.ruleset() ?? 'cpu';
    }
    return 'device';
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
    const humans = this.engine.players.filter((player) =>
      this.engine.isLive(player.id)
    );
    humans.forEach((human, index) => {
      // The last human also takes the key sets nobody else has.
      const lastSet = index === humans.length - 1 ? KEY_SETS.length - 1 : index;
      this.engine.setSteering(
        human.id,
        this.steering(human.id, keysPressed, index, lastSet)
      );
    });
  }

  /**
   * A player's stick and the held keys of their key sets - `firstSet` to
   * `lastSet` of {@link KEY_SETS} - summed.
   */
  private steering(
    playerId: number,
    keysPressed: readonly string[],
    firstSet = 0,
    lastSet = KEY_SETS.length - 1
  ): SteeringVector {
    const stick = this.sticks.get(playerId);
    const direction = { x: stick?.x ?? 0, y: stick?.y ?? 0 };
    for (let set = firstSet; set <= lastSet; set++) {
      const keySet = KEY_SETS[set];
      for (const key of keysPressed) {
        const step = keySet[key.toLowerCase()];
        if (step != null) {
          direction.x += step.x;
          direction.y += step.y;
        }
      }
    }
    return direction;
  }

  /** Mirrors the engine's players into the store, in one go, if they changed. */
  private mirror(): void {
    const players = this.engine.players;
    if (players !== this.mirrored) {
      this.mirrored = players;
      this.playerStore.upsertPlayers(players);
    }
    this.playerStore.setNeutralCount(this.engine.neutralCount);
  }
}
