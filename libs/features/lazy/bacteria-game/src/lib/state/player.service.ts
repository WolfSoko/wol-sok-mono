import type { ActiveEffect } from './evolution';
import { Injectable, computed, inject, signal, untracked } from '@angular/core';
import { Nutrient } from './bacteria-simulation';
import { Ruleset, Simulation, SimulationFactory } from './simulation';
import { intSimulation } from './gpu-int/int-simulation';
import { GameBalance } from './game-balance';
import { isSteering, Point, randomSeed, SteeringVector } from './geometry';
import { DynamicWall } from './maps';
import {
  cpuSimulation,
  FrameEvents,
  MatchEngine,
  MatchOptions,
  noFrameEvents,
  PlayerSpawn,
} from './match-engine';
import { GameStateStore } from './game.states';
import { Player } from './player.model';
import { PlayerStore } from './player.store';
import { ReplayInputs } from './replay';
import type { Lockstep } from '../net/lockstep';
import { MatchOutcome } from './win-conditions';

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
  private gameStateStore = inject(GameStateStore);

  /** Builds each match's simulation - on the CPU unless told otherwise. */
  private simulationFactory: SimulationFactory = cpuSimulation;
  /** Takes over when the factory's simulation fails to start. */
  private fallbackFactory: SimulationFactory = cpuSimulation;
  /** The ruleset the factory's simulations play by - see `useSimulation`. */
  private factoryRuleset: () => Ruleset | null = () => 'cpu';
  /** The rulesets this device offers the other one of an online match. */
  private offers: () => readonly Ruleset[] = () => ['cpu'];
  /** The integer GPU passes for an online `gpu-int` match - see `useSimulation`. */
  private readonly gpuIntFactory = signal<SimulationFactory | null>(null);

  /**
   * True while this device has the integer GPU passes to play a `gpu-int`
   * match on - a WebGL2 arena whose GPU has not failed to start them. A
   * ranked match plays them (ADR 0012, 0015); whether the GPU is trusted
   * is the self-test's word, not this.
   */
  public readonly gpuIntReady = computed(() => this.gpuIntFactory() !== null);
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
   * same way: on the integer GPU passes, `IntSimulation` standing in only
   * should the GPU fail to start. A
   * match with `recordedSeats` runs on a ruleset too, one a recording plays
   * back on as it was played (ADR 0011, 0015): the factory's, where that is
   * one, the CPU's else.
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
      simulation: (balance, random, seed) => {
        const devicePicks = lockstep === undefined && ruleset === undefined;
        if (devicePicks && rules.recordedSeats === undefined) {
          return this.createSimulation(balance, random, seed, arena);
        }
        const wanted = devicePicks
          ? (this.factoryRuleset() ?? 'cpu')
          : (ruleset ?? 'cpu');
        if (wanted === 'cpu') {
          return sized(cpuSimulation(balance, random, seed), arena);
        }
        // The deterministic GPU passes where they run here, the same
        // ruleset on the CPU else: either plays the match alike. Online
        // that follows what this device offered at the hello, not what the
        // owner's toggle says now: `IntSimulation` plays live only where
        // the GPU is gone or fails to start. A ranked match likewise.
        const gpu = devicePicks
          ? this.simulationFactory
          : untracked(this.gpuIntFactory);
        return gpu === null
          ? sized(intSimulation(balance, random, seed), arena)
          : this.createSimulation(
              balance,
              random,
              seed,
              arena,
              gpu,
              intSimulation
            );
      },
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
   * Takes effect with the next match. `fallback` takes over when one of the
   * factory's simulations fails to start. `ruleset` says which ruleset the
   * factory's simulations play by right now (null for the float GPU one),
   * `offers` which this device offers the other one of an online match
   * (ADR 0015), `gpuInt` what plays an online match agreed on `gpu-int`
   * here (null: `IntSimulation`) - see `chooseSimulation`.
   */
  public useSimulation(
    factory: SimulationFactory | null,
    fallback: SimulationFactory = cpuSimulation,
    rulesets: {
      ruleset: () => Ruleset | null;
      offers: () => readonly Ruleset[];
      gpuInt?: SimulationFactory | null;
    } = {
      ruleset: () => (factory == null ? 'cpu' : null),
      offers: () => ['cpu'],
    }
  ): void {
    this.simulationFactory = factory ?? cpuSimulation;
    this.fallbackFactory = fallback;
    this.factoryRuleset = rulesets.ruleset;
    this.offers = rulesets.offers;
    this.gpuIntFactory.set(rulesets.gpuInt ?? null);
    if (factory == null && this.engine.simulation.kind === 'gpu') {
      // It may hold a context that is going away: let it go now.
      this.engine.dispose();
      this.engine = new MatchEngine([], { seed: 0 });
    }
  }

  /** The rulesets this device can play an online match on, `cpu` always. */
  public rulesetOffers(): readonly Ruleset[] {
    return this.offers();
  }

  /**
   * A simulation from the factory, sized to the arena. Should the GPU turn
   * out not to run it - a shader its driver rejects, a format it cannot
   * render into - the fallback takes over, for this match and the next ones,
   * and the device offers the CPU's ruleset only. `fallback` stands in for
   * this match where it has to keep its ruleset - an online one.
   */
  private createSimulation(
    balance: GameBalance,
    random: () => number,
    seed: number,
    arena?: { width: number; height: number },
    factory: SimulationFactory = this.simulationFactory,
    fallback?: SimulationFactory
  ): Simulation {
    let simulation: Simulation | null = null;
    try {
      simulation = factory(balance, random, seed);
      return sized(simulation, arena);
    } catch (error) {
      // Let go of the context listeners, or a restored context revives it.
      simulation?.dispose();
      if (factory === this.fallbackFactory) {
        throw error;
      }
      console.warn('The colony war falls back to the CPU', error);
      this.simulationFactory = this.fallbackFactory;
      this.factoryRuleset = () => 'cpu';
      this.offers = () => ['cpu'];
      this.gpuIntFactory.set(null);
      return sized(
        (fallback ?? this.fallbackFactory)(balance, random, seed),
        arena
      );
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

/** The simulation, sized to the arena where it is known. */
function sized(
  simulation: Simulation,
  arena?: { width: number; height: number }
): Simulation {
  if (arena != null) {
    simulation.resize(arena.width, arena.height);
  }
  return simulation;
}
