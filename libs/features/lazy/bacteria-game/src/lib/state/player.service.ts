import { Injectable, inject } from '@angular/core';
import { ID, transaction } from '@datorama/akita';
import { BacteriaSimulation, Colony, Nutrient } from './bacteria-simulation';
import { gameBalance } from './game-balance';
import { GameStateQuery } from './game-state.query';
import { GameState } from './game.states';
import { createPlayer, Player, PlayerColorArray } from './player.model';
import { PlayerQuery } from './player.query';
import { PlayerStore } from './player.store';

@Injectable({ providedIn: 'root' })
export class PlayerService {
  private playerStore = inject(PlayerStore);
  private gameStateQuery = inject(GameStateQuery);
  private playerQuery = inject(PlayerQuery);

  private simulation = new BacteriaSimulation();
  /** Arena position a player is currently dragging their crosshair towards. */
  private dragTargets = new Map<number, { x: number; y: number }>();

  constructor() {
    this.gameStateQuery
      .selectKeysPressed()
      .subscribe((value) =>
        this.updatePlayerPos(value.keysPressed, value.deltaTimeSec)
      );
  }

  @transaction()
  /** Starts a fresh match: new players in the store, new colonies in the simulation. */
  init(
    playersData: { x: number; y: number; color: PlayerColorArray }[],
    radius = gameBalance.startBacteriaRadius
  ) {
    this.playerStore.remove();
    playersData.forEach((playerData, index) =>
      this.add(
        createPlayer({
          id: index,
          x: playerData.x,
          y: playerData.y,
          color: playerData.color,
        })
      )
    );
    this.setActive(0);
    this.dragTargets.clear();
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
    this.simulation.step(this.playerQuery.getAll(), deltaTimeSec);
    this.syncColonyStats();
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
  /** Moves both crosshairs according to the keys that are currently held. */
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

function clamp(value: number, min: number, max: number): number {
  return Math.max(Math.min(value, max), min);
}
