import type { Level } from './levels';
import { GameMap } from './maps';
import { disc } from './zones';

/**
 * The training ground: open like the Petri Dish, with a zone to hold in the
 * middle - the first mission's target, where a new player learns to steer.
 */
const trainingGround: GameMap = {
  id: 'training-ground',
  name: 'Training Ground',
  description: 'Open ground with a zone to hold in the middle.',
  createWalls: () => [],
  createZones(width, height) {
    return [disc('hill', width / 2, height / 2, height * 0.18)];
  },
};

/** The training missions, in the order they are played - see `training.ts`. */
export const MISSION_IDS = [
  'steer',
  'feed',
  'boost',
  'attack',
  'fight',
] as const;

export type MissionId = (typeof MISSION_IDS)[number];

export function isMissionId(value: unknown): value is MissionId {
  return MISSION_IDS.includes(value as MissionId);
}

/** The layouts only the training missions are played on. */
export const TRAINING_MAPS: readonly GameMap[] = [trainingGround];

/**
 * The slow, forgiving balance of the training missions - the Petri Dish's,
 * a little calmer still.
 */
const CALM = {
  aggression: 0.2,
  divideChancePerSec: 2.2,
  startBacteriaRadius: 12,
} as const;

/**
 * What every mission's level shares: the crosshair speed, and medallion
 * limits that only fill the type - a mission keeps no medallion.
 */
const MISSION_LEVEL = {
  medal: { silverSec: 60, goldSec: 30, goldLossShare: 1 },
  crosshairSpeed: 150,
} as const;

/*
 * The levels of the training missions (`training.ts`), one per mission and
 * apart from the campaign's ladder. The first four put a training dummy
 * across - a colony that sits where it spawned - the last one the easy
 * computer.
 */
export const TRAINING_LEVELS: readonly Level[] = [
  {
    ...MISSION_LEVEL,
    id: 'training-steer',
    name: 'Steer',
    description: 'Steer your colony onto the white zone and hold it.',
    mapId: 'training-ground',
    balance: { ...CALM, nutrientCount: 2 },
    crosshairSpeed: 140,
    win: { kind: 'hold', holdSec: 4 },
    mission: 'steer',
    opponent: 'dummy',
  },
  {
    ...MISSION_LEVEL,
    id: 'training-feed',
    name: 'Feed',
    description: 'Eat the pellets - they make your bacteria divide.',
    mapId: 'open-field',
    balance: { ...CALM, nutrientCount: 6, nutrientRespawnDelaySec: 1.5 },
    win: { kind: 'harvest', pellets: 8 },
    mission: 'feed',
    opponent: 'dummy',
  },
  {
    ...MISSION_LEVEL,
    id: 'training-boost',
    name: 'Boost',
    description: 'Boost to reach the pellets first.',
    mapId: 'open-field',
    // A boost that recharges quickly, to be fired twice in a short race.
    balance: {
      ...CALM,
      nutrientCount: 4,
      nutrientRespawnDelaySec: 1.5,
      boostCooldownSec: 3,
    },
    win: { kind: 'harvest', pellets: 12 },
    mission: 'boost',
    opponent: 'dummy',
  },
  {
    ...MISSION_LEVEL,
    id: 'training-attack',
    name: 'Attack',
    description: 'Drive into the dummy and wipe it out.',
    mapId: 'open-field',
    balance: { ...CALM, aggression: 0.35, nutrientCount: 4 },
    mission: 'attack',
    opponent: 'dummy',
  },
  {
    ...MISSION_LEVEL,
    id: 'training-fight',
    name: 'First Fight',
    description: 'Your first war against the computer, against the clock.',
    mapId: 'open-field',
    balance: { ...CALM, aggression: 0.25, nutrientCount: 6 },
    win: { kind: 'timed', limitSec: 60 },
    mission: 'fight',
    opponent: 'easy',
  },
];
