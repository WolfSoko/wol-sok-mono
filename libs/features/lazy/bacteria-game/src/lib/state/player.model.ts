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
  /** Boosts fired since the game started. */
  boostsFired: number;
  /** The most bacteria the colony had at once. */
  peakCount: number;
  /**
   * The lowest ratio of own to enemy bacteria so far - 1 until the colony
   * first fell behind.
   */
  lowestSizeRatio: number;
  /** Average energy of the colony, relative to {@link GameBalance.maxEnergy}. */
  averageEnergy: number;
  /** Ticks the colony held the hold zone - see `WinRule`. */
  holdTicks: number;
  /** The cooldown the last boost started - a boss's is shorter. */
  boostCooldownFullSec: number;
}

/** True while the player's boost is running. */
export function isBoosted(player: Player | null): boolean {
  return player != null && player.boostActiveSec > 0;
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
    boostsFired: 0,
    peakCount: 0,
    lowestSizeRatio: 1,
    averageEnergy: 1,
    holdTicks: 0,
    boostCooldownFullSec: 0,
    ...params,
  } as Player;
}

/**
 * A solid disc of full energy bacteria, one per grid cell. The radius may
 * be fractional - a head start shrinks it by area - and the disc steps
 * through whole cells either way.
 */
export function createBacteriaBlob(
  x: number,
  y: number,
  radius: number
): Bacteria[] {
  const result: Bacteria[] = [];
  const radiusPow = radius * radius;
  const reach = Math.ceil(radius);
  for (let dx = -reach; dx < reach; dx++) {
    for (let dy = -reach; dy < reach; dy++) {
      if (dx * dx + dy * dy <= radiusPow) {
        result.push({
          x: Math.round(dx + x),
          y: Math.round(dy + y),
          energy: gameBalance.maxEnergy,
        });
      }
    }
  }
  return result;
}
