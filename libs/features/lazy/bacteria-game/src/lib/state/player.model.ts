import { gameBalance } from './game-balance';

export type PlayerColorArray = [number, number, number, number];

/**
 * A player is only the crosshair plus the score. The bacteria themselves are
 * owned by the simulation - they change every frame and must stay mutable, so
 * they are deliberately kept out of the (frozen) store.
 */
export interface Player {
  id: number;
  x: number;
  y: number;
  color: PlayerColorArray;
  maxSpeed: number; // px / second
  /** Living bacteria of this player. */
  bacteriaCount: number;
  /** Enemy bacteria eaten since the game started. */
  captured: number;
  /** Own bacteria lost since the game started. */
  lost: number;
  /** Average energy of the colony, relative to {@link GameBalance.maxEnergy}. */
  averageEnergy: number;
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
    maxSpeed: 150,
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
