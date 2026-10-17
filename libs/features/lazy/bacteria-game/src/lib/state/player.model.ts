import { gameBalance } from './game-balance';

export type PlayerColorArray = [number, number, number, number];

/**
 * A player is only the crosshair plus the score. The bacteria themselves are
 * owned by the simulation - they change every frame and must stay mutable, so
 * they are deliberately kept out of the (frozen) store.
 */
export interface Player {
  id: number;
  /** Shown on the scoreboard and in the winner dialog. */
  name: string;
  /** True when the computer steers this crosshair. */
  isBot: boolean;
  x: number;
  y: number;
  color: PlayerColorArray;
  maxSpeed: number; // px / second
  /** Seconds the current boost keeps running, 0 while there is none. */
  boostActiveSec: number;
  /** Seconds until the next boost can be fired, 0 when it is ready. */
  boostCooldownSec: number;
  /** Living bacteria of this player. */
  bacteriaCount: number;
  /** Enemy bacteria eaten since the game started. */
  captured: number;
  /** Own bacteria lost since the game started. */
  lost: number;
  /** Average energy of the colony, relative to {@link GameBalance.maxEnergy}. */
  averageEnergy: number;
}

/** True when the player can fire a boost right now. */
export function isBoostReady(player: Player): boolean {
  return player.boostActiveSec <= 0 && player.boostCooldownSec <= 0;
}

export interface Bacteria {
  x: number;
  y: number;
  energy: number;
}

let playerId = 0;

/**
 * A factory function that creates Player
 */
export function createPlayer(params: Partial<Player>): Player {
  return {
    id: playerId++,
    name: '',
    isBot: false,
    maxSpeed: 150,
    boostActiveSec: 0,
    boostCooldownSec: 0,
    bacteriaCount: 0,
    captured: 0,
    lost: 0,
    averageEnergy: 1,
    ...params,
  } as Player;
}

/** A solid disc of full energy bacteria, one per grid cell. */
export function createBacteriaBlob(
  x: number,
  y: number,
  radius: number
): Bacteria[] {
  const result: Bacteria[] = [];
  const radiusPow = radius * radius;
  for (let i = 0; i < radius * 2; i++) {
    for (let j = 0; j < radius * 2; j++) {
      const testX = i - radius;
      const testY = j - radius;

      if (testX * testX + testY * testY <= radiusPow) {
        result.push({
          x: Math.round(testX + x),
          y: Math.round(testY + y),
          energy: gameBalance.maxEnergy,
        });
      }
    }
  }
  return result;
}
