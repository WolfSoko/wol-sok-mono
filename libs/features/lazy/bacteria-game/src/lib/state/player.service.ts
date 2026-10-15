import { Injectable, inject } from '@angular/core';
import { ID, transaction } from '@datorama/akita';
import { BacteriaSimulation, Colony, Nutrient } from './bacteria-simulation';
import {
  BotController,
  BotDifficulty,
  BotView,
  ColonyView,
} from './bot-controller';
import { GameBalance, gameBalance } from './game-balance';
import { GameStateQuery } from './game-state.query';
import { GameState } from './game.states';
import { DEFAULT_CROSSHAIR_SPEED } from './levels';
import { GameMap, getMap } from './maps';
import { createPlayer, Player, PlayerColorArray } from './player.model';
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

@Injectable({ providedIn: 'root' })
export class PlayerService {
  private playerStore = inject(PlayerStore);
  private gameStateQuery = inject(GameStateQuery);
  private playerQuery = inject(PlayerQuery);

  private simulation = new BacteriaSimulation();
  private balance: GameBalance = gameBalance;
  /** Arena position a player is currently dragging their crosshair towards. */
  private dragTargets = new Map<number, { x: number; y: number }>();
  /** The computer opponents, one per bot player. */
  private bots = new Map<number, BotController>();

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
  init(
    playersData: PlayerSpawn[],
    options: {
      balance?: GameBalance;
      map?: GameMap;
      crosshairSpeed?: number;
      difficulty?: BotDifficulty;
    } = {}
  ) {
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
        this.bots.set(index, new BotController(options.difficulty ?? 'normal'));
      }
    });
    this.setActive(0);
    this.dragTargets.clear();
    this.balance = balance;
    this.simulation = new BacteriaSimulation(balance);
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
  setActive(playerId: ID) {
    this.playerStore.setActive(playerId);
  }

  /** Adds a player to the store. */
  add(player: Player) {
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
  setDragTarget(playerId: number, x: number, y: number) {
    this.dragTargets.set(playerId, { x, y });
  }

  /**
   * Fires a player's boost. Nothing happens while the previous one is still
   * cooling down, so hammering the key does not help.
   */
  boost(playerId: number): void {
    const player = this.playerQuery.getEntity(playerId);
    if (player == null || player.boostCooldownSec > 0) {
      return;
    }
    this.playerStore.update(playerId, {
      boostActiveSec: this.balance.boostDurationSec,
      boostCooldownSec: this.balance.boostCooldownSec,
    });
  }

  /** The nutrient pellets currently on the map - used for rendering only. */
  getNutrients(): Nutrient[] {
    return this.simulation.getNutrients();
  }

  /** The live bacteria of every colony - used for rendering only. */
  getColonies(): readonly Colony[] {
    return this.simulation.getColonies();
  }

  /** Advances the whole colony war by one frame. */
  gameLoop(width: number, height: number, deltaTimeSec: number) {
    this.simulation.resize(width, height);
    this.tickBoosts(deltaTimeSec);
    this.runBots(width, height, deltaTimeSec);
    this.simulation.step(this.playerQuery.getAll(), deltaTimeSec);
    this.syncColonyStats();
  }

  /** Counts the boost timers of every player down. */
  @transaction()
  private tickBoosts(deltaTimeSec: number): void {
    for (const player of this.playerQuery.getAll()) {
      if (player.boostActiveSec <= 0 && player.boostCooldownSec <= 0) {
        continue;
      }
      this.playerStore.update(player.id, {
        boostActiveSec: Math.max(0, player.boostActiveSec - deltaTimeSec),
        boostCooldownSec: Math.max(0, player.boostCooldownSec - deltaTimeSec),
      });
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
        player.boostCooldownSec <= 0,
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
  private syncColonyStats() {
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
   * Moves the crosshairs according to the keys that are currently held.
   *
   * WASD belongs to the first player and the arrow keys to the second one.
   * Against the computer there is only one human, who may use either set, and
   * the keys never touch the bot's crosshair.
   */
  private updatePlayerPos(keysPressed: string[], deltaTimeInSec: number) {
    let xDir0 = 0;
    let yDir0 = 0;
    let xDir1 = 0;
    let yDir1 = 0;

    keysPressed.forEach((key) => {
      switch (key.toLowerCase()) {
        case 'arrowup':
          yDir1 = yDir1 - 1;
          break;
        case 'arrowdown':
          yDir1 = yDir1 + 1;
          break;
        case 'arrowright':
          xDir1 = xDir1 + 1;
          break;
        case 'arrowleft':
          xDir1 = xDir1 - 1;
          break;
        case 'w':
          yDir0 = yDir0 - 1;
          break;
        case 's':
          yDir0 = yDir0 + 1;
          break;
        case 'd':
          xDir0 = xDir0 + 1;
          break;
        case 'a':
          xDir0 = xDir0 - 1;
          break;
      }
    });
    const gameState = this.gameStateQuery.getValue();
    if (gameState.currentState !== GameState.RUNNING) {
      return;
    }
    if (this.bots.has(1)) {
      this.movePlayer(
        0,
        Math.sign(xDir0 + xDir1),
        Math.sign(yDir0 + yDir1),
        deltaTimeInSec
      );
      this.movePlayer(1, 0, 0, deltaTimeInSec);
      return;
    }
    this.movePlayer(0, xDir0, yDir0, deltaTimeInSec);
    this.movePlayer(1, xDir1, yDir1, deltaTimeInSec);
  }

  /**
   * Moves one crosshair, kept inside the arena.
   *
   * A held key wins over a drag target - pressing a key drops the target, so a
   * stale one cannot keep pulling the crosshair back.
   */
  private movePlayer(
    id: ID,
    xDir: number,
    yDir: number,
    deltaTimeInSec: number
  ) {
    const playerId = Number(id);
    if (xDir !== 0 || yDir !== 0) {
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

/**
 * Condenses the live colonies into what the bot is allowed to look at: centres
 * of mass, sizes, average energy and the enemy bacterium closest to its own
 * colony.
 */
export function buildBotView(
  width: number,
  height: number,
  own: Colony,
  colonies: readonly Colony[],
  nutrients: readonly Nutrient[],
  boostReady: boolean,
  maxEnergy: number
): BotView {
  const ownView = colonyView(own, maxEnergy);
  let enemy: ColonyView | null = null;
  let enemyColony: Colony | null = null;
  for (const colony of colonies) {
    if (colony === own || colony.bacterias.length === 0) {
      continue;
    }
    const view = colonyView(colony, maxEnergy);
    if (enemy == null || view.count > enemy.count) {
      enemy = view;
      enemyColony = colony;
    }
  }

  let nearestEnemy: { x: number; y: number } | null = null;
  if (enemyColony != null) {
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const bacterium of enemyColony.bacterias) {
      const dx = bacterium.x - ownView.x;
      const dy = bacterium.y - ownView.y;
      const distance = dx * dx + dy * dy;
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestEnemy = { x: bacterium.x, y: bacterium.y };
      }
    }
  }

  return {
    width,
    height,
    own: ownView,
    enemy,
    nearestEnemy,
    nutrients,
    boostReady,
  };
}

/** Centre of mass, size and average energy of a colony. */
function colonyView(colony: Colony, maxEnergy: number): ColonyView {
  const count = colony.bacterias.length;
  if (count === 0) {
    return { x: 0, y: 0, count: 0, energy: 0 };
  }
  let sumX = 0;
  let sumY = 0;
  for (const bacterium of colony.bacterias) {
    sumX += bacterium.x;
    sumY += bacterium.y;
  }
  return {
    x: sumX / count,
    y: sumY / count,
    count,
    energy: colony.totalEnergy / count / maxEnergy,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(Math.min(value, max), min);
}
