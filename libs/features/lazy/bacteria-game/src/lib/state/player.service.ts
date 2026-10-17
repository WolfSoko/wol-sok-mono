import { Injectable, inject } from '@angular/core';
import { ID, transaction } from '@datorama/akita';
import {
  BacteriaSimulation,
  Colony,
  Nutrient,
  StepEvents,
} from './bacteria-simulation';
import {
  BotController,
  BotDifficulty,
  buildBotView,
  DEFAULT_DIFFICULTY,
} from './bot-controller';
import { GameBalance, gameBalance } from './game-balance';
import { GameStateQuery } from './game-state.query';
import { GameState } from './game.states';
import {
  clamp,
  clampLength,
  isSteering,
  Point,
  SteeringVector,
} from './geometry';
import { DEFAULT_CROSSHAIR_SPEED } from './levels';
import { DynamicWall, GameMap, getMap } from './maps';
import {
  createPlayer,
  isBoostReady,
  Player,
  PlayerColorArray,
} from './player.model';
import { PlayerQuery } from './player.query';
import { PlayerStore } from './player.store';

/** What a match needs to know about one player before it starts. */
export interface PlayerSpawn {
  x: number;
  y: number;
  color: PlayerColorArray;
  name: string;
  /** True when the computer steers this crosshair. */
  isBot: boolean;
}

/**
 * The keys that steer a crosshair, one set per human player: WASD for the
 * first one, the arrow keys for the second one. Each key asks for one axis
 * at -1 or 1; the keys and the joystick of a player are summed, and
 * `movePlayer` caps the sum at unit length.
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

@Injectable({ providedIn: 'root' })
export class PlayerService {
  private playerStore = inject(PlayerStore);
  private gameStateQuery = inject(GameStateQuery);
  private playerQuery = inject(PlayerQuery);

  private simulation = new BacteriaSimulation();
  private balance: GameBalance = gameBalance;
  /** Arena position a player is currently dragging their crosshair towards. */
  private dragTargets = new Map<number, Point>();
  /** Where each player's joystick is pushed right now, absent while at rest. */
  private steering = new Map<number, SteeringVector>();
  /** The computer opponents, one per bot player. */
  private bots = new Map<number, BotController>();
  /** Boosts fired since the sound last asked - true for the computer's. */
  private firedBoosts: boolean[] = [];

  constructor() {
    this.gameStateQuery
      .selectKeysPressed()
      .subscribe((value) =>
        this.updatePlayerPos(value.keysPressed, value.deltaTimeSec)
      );
  }

  @transaction()
  /**
   * Starts a fresh match: new players in the store, new colonies in the
   * simulation.
   *
   * The level decides the wall layout and the balance, so the simulation is
   * rebuilt with them - its balance is fixed for the lifetime of a match on
   * purpose, nothing may change the rules while the colonies are fighting.
   */
  public init(
    playersData: PlayerSpawn[],
    options: {
      balance?: GameBalance;
      map?: GameMap;
      crosshairSpeed?: number;
      difficulty?: BotDifficulty;
      /**
       * The arena size, when it is known. The walls are only laid out once
       * the simulation has a size, and the start screen shows the gates and
       * sliding walls of the next match as well.
       */
      arena?: { width: number; height: number };
    } = {}
  ): void {
    const balance = options.balance ?? gameBalance;
    const map = options.map ?? getMap('corridors');
    const radius = balance.startBacteriaRadius;

    this.playerStore.remove();
    this.bots.clear();
    playersData.forEach((playerData, index) => {
      this.add(
        createPlayer({
          id: index,
          x: playerData.x,
          y: playerData.y,
          color: playerData.color,
          name: playerData.name,
          isBot: playerData.isBot,
          maxSpeed: options.crosshairSpeed ?? DEFAULT_CROSSHAIR_SPEED,
        })
      );
      if (playerData.isBot) {
        this.bots.set(
          index,
          new BotController(options.difficulty ?? DEFAULT_DIFFICULTY)
        );
      }
    });
    this.setActive(0);
    this.dragTargets.clear();
    this.steering.clear();
    this.balance = balance;
    this.firedBoosts = [];
    this.simulation = new BacteriaSimulation(balance);
    if (options.arena != null) {
      this.simulation.resize(options.arena.width, options.arena.height);
    }
    this.simulation.setMap(map);
    this.simulation.init(
      playersData.map((playerData, index) => ({
        playerId: index,
        color: playerData.color,
        x: playerData.x,
        y: playerData.y,
        radius,
      }))
    );
    this.syncColonyStats();
  }

  /** Marks a player as the active one in the store. */
  public setActive(playerId: ID): void {
    this.playerStore.setActive(playerId);
  }

  /** Adds a player to the store. */
  public add(player: Player): void {
    this.playerStore.add(player);
  }

  /**
   * Steers a crosshair towards an arena position, for pointer and touch input.
   *
   * The crosshair travels there at `maxSpeed` instead of jumping, so dragging
   * is no faster than the keyboard and the two input methods stay comparable.
   *
   * The target outlives the gesture, so a tap sends the crosshair across the
   * arena instead of nudging it for a single frame. It is dropped once the
   * crosshair arrives, or as soon as the player touches a key.
   */
  public setDragTarget(playerId: number, x: number, y: number): void {
    this.dragTargets.set(playerId, { x, y });
  }

  /**
   * Pushes a player's joystick, for the on-screen sticks of the touch layout.
   *
   * The stick works like a held key: the crosshair keeps moving at up to
   * `maxSpeed` in that direction - slower for a gentle push - until the stick
   * is released with the zero vector. Like a key it wins over a drag target.
   */
  public setSteering(playerId: number, vector: SteeringVector): void {
    if (isSteering(vector)) {
      this.steering.set(playerId, vector);
    } else {
      this.steering.delete(playerId);
    }
  }

  /**
   * Fires a player's boost. Nothing happens while one is running or the
   * previous one is still recharging, so hammering the key does not help.
   */
  public boost(playerId: number): void {
    const player = this.playerQuery.getEntity(playerId);
    if (player == null || !isBoostReady(player)) {
      return;
    }
    this.playerStore.update(playerId, {
      boostActiveSec: this.balance.boostDurationSec,
      boostCooldownSec: this.balance.boostCooldownSec,
    });
    this.firedBoosts.push(player.isBot);
  }

  /**
   * The boosts fired since the last call, true for each one the computer
   * fired - used for the sound only.
   */
  public takeFiredBoosts(): boolean[] {
    const fired = this.firedBoosts;
    this.firedBoosts = [];
    return fired;
  }

  /** The nutrient pellets currently on the map - used for rendering only. */
  public getNutrients(): Nutrient[] {
    return this.simulation.getNutrients();
  }

  /** The gates and sliding walls as they stand - used for rendering only. */
  public getDynamicWalls(): readonly DynamicWall[] {
    return this.simulation.getDynamicWalls();
  }

  /** What happened during the last frame - used for the sound only. */
  public getStepEvents(): StepEvents {
    return this.simulation.getEvents();
  }

  /** The live bacteria of every colony - used for rendering only. */
  public getColonies(): readonly Colony[] {
    return this.simulation.getColonies();
  }

  /** Advances the whole colony war by one frame. */
  public gameLoop(width: number, height: number, deltaTimeSec: number): void {
    this.simulation.resize(width, height);
    this.tickBoosts(deltaTimeSec);
    this.runBots(width, height, deltaTimeSec);
    this.simulation.step(this.playerQuery.getAll(), deltaTimeSec);
    this.syncColonyStats();
  }

  /**
   * Counts the boost timers down. The boost runs out first, only then does
   * the recharge start - so a player waits the full cooldown after a boost.
   */
  @transaction()
  private tickBoosts(deltaTimeSec: number): void {
    for (const player of this.playerQuery.getAll()) {
      if (player.boostActiveSec > 0) {
        this.playerStore.update(player.id, {
          boostActiveSec: Math.max(0, player.boostActiveSec - deltaTimeSec),
        });
      } else if (player.boostCooldownSec > 0) {
        this.playerStore.update(player.id, {
          boostCooldownSec: Math.max(0, player.boostCooldownSec - deltaTimeSec),
        });
      }
    }
  }

  /** Lets every computer opponent look at the arena and steer its crosshair. */
  private runBots(width: number, height: number, deltaTimeSec: number): void {
    if (this.bots.size === 0) {
      return;
    }
    const colonies = this.simulation.getColonies();
    for (const [playerId, bot] of this.bots) {
      const player = this.playerQuery.getEntity(playerId);
      const own = colonies.find((colony) => colony.playerId === playerId);
      if (player == null || own == null) {
        continue;
      }
      const view = buildBotView(
        width,
        height,
        own,
        colonies,
        this.simulation.getNutrients(),
        isBoostReady(player),
        this.balance.maxEnergy
      );
      const decision = bot.decide(view, deltaTimeSec);
      if (decision.target != null) {
        this.setDragTarget(playerId, decision.target.x, decision.target.y);
      }
      if (decision.boost) {
        this.boost(playerId);
      }
    }
  }

  /** Mirrors the colony scoreboard into the store, the bacteria stay out of it. */
  @transaction()
  private syncColonyStats(): void {
    for (const colony of this.simulation.getColonies()) {
      const bacteriaCount = colony.bacterias.length;
      this.playerStore.update(colony.playerId, {
        bacteriaCount,
        captured: colony.captured,
        lost: colony.lost,
        averageEnergy:
          bacteriaCount > 0 ? colony.totalEnergy / bacteriaCount : 0,
      });
    }
  }

  @transaction()
  /**
   * Moves the crosshairs according to the keys that are currently held and
   * the joysticks that are pushed.
   *
   * Each key set belongs to one human player, in order. With a single human
   * every set steers that one crosshair, so against the computer WASD and the
   * arrow keys both work - and the keys never touch a bot's crosshair. A
   * joystick is bound to its player directly.
   */
  private updatePlayerPos(keysPressed: string[], deltaTimeInSec: number): void {
    if (this.gameStateQuery.getValue().currentState !== GameState.RUNNING) {
      return;
    }
    const humans = this.playerQuery.getAll().filter((player) => !player.isBot);
    const directions = humans.map(() => ({ x: 0, y: 0 }));

    KEY_SETS.forEach((keySet, setIndex) => {
      const direction = directions[Math.min(setIndex, directions.length - 1)];
      if (direction == null) {
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

    for (const player of this.playerQuery.getAll()) {
      const index = humans.indexOf(player);
      const direction = index >= 0 ? directions[index] : { x: 0, y: 0 };
      const stick = this.steering.get(player.id);
      if (stick != null) {
        direction.x += stick.x;
        direction.y += stick.y;
      }
      this.movePlayer(player.id, direction, deltaTimeInSec);
    }
  }

  /**
   * Moves one crosshair, kept inside the arena.
   *
   * The direction is capped at unit length, so a diagonal - two keys at once,
   * or a stick pulled to the rim - is no faster than a straight line. A held
   * key or a pushed stick wins over a drag target - it drops the target, so a
   * stale one cannot keep pulling the crosshair back.
   */
  private movePlayer(
    id: ID,
    direction: SteeringVector,
    deltaTimeInSec: number
  ): void {
    const playerId = Number(id);
    const { x: xDir, y: yDir } = clampLength(direction, 1);
    if (isSteering(direction)) {
      this.dragTargets.delete(playerId);
    }
    const target = this.dragTargets.get(playerId);
    const { width, height } = this.gameStateQuery.getValue();

    this.playerStore.update(id, (state) => {
      const step = state.maxSpeed * deltaTimeInSec;
      if (target == null) {
        return {
          x: clamp(state.x + xDir * step, 0, width),
          y: clamp(state.y + yDir * step, 0, height),
        };
      }
      const dX = target.x - state.x;
      const dY = target.y - state.y;
      const distance = Math.hypot(dX, dY);
      if (distance <= step || distance === 0) {
        this.dragTargets.delete(playerId);
        return { x: target.x, y: target.y };
      }
      return {
        x: state.x + (dX / distance) * step,
        y: state.y + (dY / distance) * step,
      };
    });
  }
}
