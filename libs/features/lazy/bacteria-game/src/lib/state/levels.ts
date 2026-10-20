import { GameBalance, gameBalance } from './game-balance';
import { getMap } from './game-maps';
import { GameMap } from './maps';
import { MedalLimits } from './medallions';
import { WinRule } from './win-conditions';
import {
  generatedLevel,
  parseGeneratedId,
} from './level-generator/generate-level';

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
  /** How fast and cleanly the level has to be won for each medallion. */
  medal: MedalLimits;
  /** How the level is won - by annihilation when absent. */
  win?: WinRule;
}

/*
 * The medallion limits are a first pass from bot matches - the hard computer
 * against the normal one, four per level: silver near the median win, gold
 * near two thirds of it, and the gold losses near the median share lost. The
 * busy levels lose more bacteria than their colony ever held, hence shares
 * above 1. Tune them by playing.
 */
export const LEVELS: readonly Level[] = [
  {
    id: 'petri-dish',
    name: '1 · Petri Dish',
    description:
      'Open ground and a slow war - room to learn how a colony is steered.',
    mapId: 'open-field',
    medal: { silverSec: 90, goldSec: 60, goldLossShare: 0.45 },
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
      'Two walls with offset gaps that slam shut every few seconds. Push through before the enemy - or the gate - does.',
    mapId: 'corridors',
    medal: { silverSec: 95, goldSec: 60, goldLossShare: 0.8 },
  },
  {
    id: 'hourglass',
    name: '3 · Hourglass',
    description:
      'One narrow waist in the centre that pinches shut now and then, and richer food. Holding the gap decides the match.',
    mapId: 'hourglass',
    medal: { silverSec: 60, goldSec: 40, goldLossShare: 0.5 },
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
    medal: { silverSec: 150, goldSec: 90, goldLossShare: 0.8 },
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
    medal: { silverSec: 40, goldSec: 25, goldLossShare: 0.3 },
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
    medal: { silverSec: 45, goldSec: 30, goldLossShare: 0.3 },
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
    medal: { silverSec: 60, goldSec: 35, goldLossShare: 0.3 },
    balance: {
      aggression: 0.8,
      divideChancePerSec: 4,
      combatDrainPerSec: 2.2,
      nutrientCount: 10,
      nutrientRespawnDelaySec: 1.5,
    },
    crosshairSpeed: 200,
  },
  {
    id: 'pistons',
    name: '8 · Pistons',
    description:
      'Two sliding bars sweep the middle and shove both colonies around. Time your push between them.',
    mapId: 'pistons',
    medal: { silverSec: 60, goldSec: 40, goldLossShare: 0.9 },
    balance: {
      aggression: 0.75,
      divideChancePerSec: 3.8,
      combatDrainPerSec: 2.2,
      nutrientCount: 10,
      nutrientRespawnDelaySec: 1.5,
    },
    crosshairSpeed: 200,
  },
  // The organic levels: walls that grew rather than were built, and some
  // that are alive. The hardest balance of the game.
  {
    id: 'alveoli',
    name: '9 · Alveoli',
    description:
      'Packed air sacs and nothing straight between them. Thread your colony through the channels before the enemy floods them.',
    mapId: 'alveoli',
    medal: { silverSec: 100, goldSec: 60, goldLossShare: 0.6 },
    balance: {
      aggression: 0.8,
      divideChancePerSec: 4,
      combatDrainPerSec: 2.2,
      nutrientCount: 12,
      nutrientRespawnDelaySec: 1.5,
    },
    crosshairSpeed: 200,
  },
  {
    id: 'mycelium',
    name: '10 · Mycelium',
    description:
      'Fungal threads branch in from both edges - a maze nobody planned, with restless colonies in every pocket.',
    mapId: 'mycelium',
    medal: { silverSec: 70, goldSec: 45, goldLossShare: 0.35 },
    balance: {
      aggression: 0.85,
      divideChancePerSec: 4.2,
      combatDrainPerSec: 2.4,
      jitter: 0.4,
      nutrientCount: 12,
      nutrientRespawnDelaySec: 1.4,
    },
    crosshairSpeed: 210,
  },
  {
    id: 'heartbeat',
    name: '11 · Heartbeat',
    description:
      'A heart in the middle swells with every beat and shoves both colonies away. Strike between the beats.',
    mapId: 'heartbeat',
    medal: { silverSec: 80, goldSec: 50, goldLossShare: 1.8 },
    balance: {
      aggression: 0.9,
      divideChancePerSec: 4.4,
      combatDrainPerSec: 2.5,
      nutrientCount: 12,
      nutrientRespawnDelaySec: 1.2,
    },
    crosshairSpeed: 210,
  },
  {
    id: 'villi',
    name: '12 · Villi',
    description:
      'The lining of a gut: soft fingers sway in from both edges and sweep everything along. The final and fiercest war.',
    mapId: 'villi',
    medal: { silverSec: 45, goldSec: 30, goldLossShare: 3.4 },
    balance: {
      aggression: 0.95,
      divideChancePerSec: 4.6,
      combatDrainPerSec: 2.7,
      captureEnergy: 0.4,
      nutrientCount: 14,
      nutrientRespawnDelaySec: 1.2,
    },
    crosshairSpeed: 220,
  },
  // The reactor: the match no longer waits for a colony to be wiped out.
  {
    id: 'half-life',
    name: '13 · Half-Life',
    description:
      'The reactor shuts down after two and a half minutes - whoever holds the bigger colony then wins. Wipe the enemy out sooner for the better medallions.',
    mapId: 'reactor-core',
    medal: { silverSec: 100, goldSec: 65, goldLossShare: 1.2 },
    win: { kind: 'timed', limitSec: 150 },
    balance: {
      aggression: 0.85,
      divideChancePerSec: 4.2,
      combatDrainPerSec: 2.4,
      nutrientCount: 12,
      nutrientRespawnDelaySec: 1.4,
    },
    crosshairSpeed: 210,
  },
];

/** True for the id of a level of the game - a generated one included. */
export function isLevelId(value: unknown): value is string {
  return (
    LEVELS.some((level) => level.id === value) ||
    (typeof value === 'string' && parseGeneratedId(value) !== null)
  );
}

/**
 * The level with that id - a generated one for a `gen:` id - falling back to
 * the first one.
 */
export function getLevel(id: string): Level {
  return (
    LEVELS.find((level) => level.id === id) ??
    generatedLevel(id)?.level ??
    LEVELS[0]
  );
}

/**
 * The full balance of a level: the base table with its tweaks applied, for an
 * arena with `scale` cells per base cell. Lengths grow with the cells, and
 * the room for bacteria and the food for them with the area. The bacteria
 * still move and divide a cell at a time, so the fronts cross a finer grid
 * a little slower.
 */
export function levelBalance(level: Level, scale = 1): GameBalance {
  const balance = { ...gameBalance, ...level.balance };
  if (scale === 1) {
    return balance;
  }
  const area = scale * scale;
  return {
    ...balance,
    startBacteriaRadius: Math.round(balance.startBacteriaRadius * scale),
    maxBacteriaPerPlayer: Math.round(balance.maxBacteriaPerPlayer * area),
    maxTotalBacteria: Math.round(balance.maxTotalBacteria * area),
    influenceCellSize: Math.max(
      1,
      Math.round(balance.influenceCellSize * scale)
    ),
    nutrientRadius: Math.max(1, Math.round(balance.nutrientRadius * scale)),
    nutrientEnergy: balance.nutrientEnergy * area,
  };
}

/** The map a level is fought on. */
export function levelMap(level: Level): GameMap {
  return getMap(level.mapId);
}

/** A level's name without its number - "Hourglass" for "3 · Hourglass". */
export function levelTitle(level: Level): string {
  return level.name.replace(/^\d+ · /, '');
}

/** The level before this one, or null when it is the first. */
export function previousLevel(id: string): Level | null {
  const index = LEVELS.findIndex((level) => level.id === id);
  return index > 0 ? LEVELS[index - 1] : null;
}

/** The level after this one, or null when it is the last. */
export function nextLevel(id: string): Level | null {
  const index = LEVELS.findIndex((level) => level.id === id);
  if (index < 0 || index + 1 >= LEVELS.length) {
    return null;
  }
  return LEVELS[index + 1];
}

/**
 * How fast the crosshairs travel in this level, in cells per second on an
 * arena with `scale` cells per base cell.
 */
export function levelCrosshairSpeed(level: Level, scale = 1): number {
  return (level.crosshairSpeed ?? DEFAULT_CROSSHAIR_SPEED) * scale;
}

/** Speed of the crosshairs when a level does not ask for another one. */
export const DEFAULT_CROSSHAIR_SPEED = 150;
