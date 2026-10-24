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

/** The id of a mission's level: `training-steer`. */
export function trainingLevelId(mission: MissionId): string {
  return `training-${mission}`;
}

/** The mission a level is played for, null for a level of no mission. */
export function missionOfLevel(levelId: string): MissionId | null {
  const id = levelId.replace(/^training-/, '');
  return id !== levelId && isMissionId(id) ? id : null;
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

/*
 * The levels of the training missions (`training.ts`), one per mission and
 * apart from the campaign's ladder: they keep no medallion, so the limits
 * below only fill the type. The first four put a training dummy across -
 * a colony that sits where it spawned - the last one the easy computer.
 */
export const TRAINING_LEVELS: readonly Level[] = [
  {
    id: trainingLevelId('steer'),
    name: 'Steer',
    description: 'Steer your colony onto the white zone and hold it.',
    mapId: 'training-ground',
    medal: { silverSec: 30, goldSec: 20, goldLossShare: 1 },
    balance: { ...CALM, nutrientCount: 2 },
    crosshairSpeed: 140,
    win: { kind: 'hold', holdSec: 4 },
    dummy: true,
  },
  {
    id: trainingLevelId('feed'),
    name: 'Feed',
    description: 'Eat the pellets - they make your bacteria divide.',
    mapId: 'open-field',
    medal: { silverSec: 45, goldSec: 30, goldLossShare: 1 },
    balance: { ...CALM, nutrientCount: 6, nutrientRespawnDelaySec: 1.5 },
    crosshairSpeed: 150,
    win: { kind: 'harvest', pellets: 8 },
    dummy: true,
  },
  {
    id: trainingLevelId('boost'),
    name: 'Boost',
    description: 'Boost to reach the pellets first.',
    mapId: 'open-field',
    medal: { silverSec: 45, goldSec: 30, goldLossShare: 1 },
    // A boost that recharges quickly, to be fired twice in a short race.
    balance: {
      ...CALM,
      nutrientCount: 4,
      nutrientRespawnDelaySec: 1.5,
      boostCooldownSec: 3,
    },
    crosshairSpeed: 150,
    win: { kind: 'harvest', pellets: 12 },
    dummy: true,
  },
  {
    id: trainingLevelId('attack'),
    name: 'Attack',
    description: 'Drive into the dummy and wipe it out.',
    mapId: 'open-field',
    medal: { silverSec: 45, goldSec: 30, goldLossShare: 1 },
    balance: { ...CALM, aggression: 0.35, nutrientCount: 4 },
    crosshairSpeed: 150,
    dummy: true,
  },
  {
    id: trainingLevelId('fight'),
    name: 'First Fight',
    description: 'Your first war against the computer, against the clock.',
    mapId: 'open-field',
    medal: { silverSec: 120, goldSec: 90, goldLossShare: 1 },
    balance: { ...CALM, aggression: 0.25, nutrientCount: 6 },
    crosshairSpeed: 150,
    win: { kind: 'timed', limitSec: 60 },
  },
];
