import { GameBalance, gameBalance } from './game-balance';
import { GameMap, getMap } from './maps';

/**
 * A level is a map plus the tuning that makes it play differently.
 *
 * The list is ordered from calm to frantic, so playing through it from the top
 * is a difficulty curve: more aggression, faster division and tighter arenas
 * the further down you get.
 */
export interface Level {
  /** Stable id, stored in the game state. */
  id: string;
  name: string;
  /** Short briefing shown next to the level picker. */
  description: string;
  /** Id of the {@link GameMap} this level is fought on. */
  mapId: string;
  /** Tweaks applied on top of the base {@link gameBalance}. */
  balance?: Partial<GameBalance>;
  /** How fast the crosshairs travel, in arena pixels per second. */
  crosshairSpeed?: number;
}

export const LEVELS: readonly Level[] = [
  {
    id: 'petri-dish',
    name: '1 · Petri Dish',
    description:
      'Open ground and a slow war - room to learn how a colony is steered.',
    mapId: 'open-field',
    balance: {
      aggression: 0.25,
      divideChancePerSec: 2.2,
      nutrientCount: 4,
      startBacteriaRadius: 12,
    },
    crosshairSpeed: 140,
  },
  {
    id: 'corridors',
    name: '2 · Corridors',
    description:
      'Two walls with offset gaps. Push through one of them before the enemy does.',
    mapId: 'corridors',
  },
  {
    id: 'hourglass',
    name: '3 · Hourglass',
    description:
      'One narrow waist in the centre, richer food. Holding the gap decides the match.',
    mapId: 'hourglass',
    balance: {
      aggression: 0.55,
      nutrientCount: 6,
      nutrientRespawnDelaySec: 2,
    },
    crosshairSpeed: 160,
  },
  {
    id: 'inner-ring',
    name: '4 · Inner Ring',
    description:
      'A walled ring with one door per side, food everywhere and colonies out for a fight.',
    mapId: 'inner-ring',
    balance: {
      aggression: 0.6,
      nutrientCount: 12,
      nutrientRespawnDelaySec: 1.5,
      divideChancePerSec: 3.5,
    },
    crosshairSpeed: 170,
  },
  {
    id: 'pillar-field',
    name: '5 · Pillar Field',
    description:
      'Pillars everywhere and a shorter time to kill - the frontline breaks into pockets.',
    mapId: 'pillar-field',
    balance: {
      aggression: 0.7,
      combatDrainPerSec: 2,
      jitter: 0.35,
      nutrientCount: 10,
    },
    crosshairSpeed: 180,
  },
  {
    id: 'twin-chambers',
    name: '6 · Twin Chambers',
    description:
      'Big colonies boxed in behind their own walls, and captures over kills.',
    mapId: 'twin-chambers',
    balance: {
      startBacteriaRadius: 16,
      consumeChance: 0.35,
      energyRegenPerSec: 0.25,
      captureEnergy: 0.45,
      nutrientCount: 8,
    },
    crosshairSpeed: 180,
  },
  {
    id: 'serpentine',
    name: '7 · Serpentine',
    description:
      'A winding path, relentless colonies and division at full speed. No safe corner left.',
    mapId: 'serpentine',
    balance: {
      aggression: 0.8,
      divideChancePerSec: 4,
      combatDrainPerSec: 2.2,
      nutrientCount: 10,
      nutrientRespawnDelaySec: 1.5,
    },
    crosshairSpeed: 200,
  },
];

/** The level with that id, falling back to the first one. */
export function getLevel(id: string): Level {
  return LEVELS.find((level) => level.id === id) ?? LEVELS[0];
}

/** The full balance of a level: the base table with its tweaks applied. */
export function levelBalance(level: Level): GameBalance {
  return { ...gameBalance, ...level.balance };
}

/** The map a level is fought on. */
export function levelMap(level: Level): GameMap {
  return getMap(level.mapId);
}

/** The level after this one, or null when it is the last. */
export function nextLevel(id: string): Level | null {
  const index = LEVELS.findIndex((level) => level.id === id);
  if (index < 0 || index + 1 >= LEVELS.length) {
    return null;
  }
  return LEVELS[index + 1];
}

/** How fast the crosshairs travel in this level. */
export function levelCrosshairSpeed(level: Level): number {
  return level.crosshairSpeed ?? DEFAULT_CROSSHAIR_SPEED;
}

/** Speed of the crosshairs when a level does not ask for another one. */
export const DEFAULT_CROSSHAIR_SPEED = 150;
