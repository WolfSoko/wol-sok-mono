import type { GameText } from '../i18n/game-text';
import { getLevel } from './levels';
import type { MatchRecord } from './medallions';
import { earlierDays, Progress } from './progress';
import { MISSION_IDS, MissionId } from './training-levels';

export type { MissionId } from './training-levels';

/**
 * The training: five short missions for new players, each teaching one
 * thing - steering, the food, the boost, attacking, a first fight. A
 * mission is a level of its own (`training-levels.ts`), which names the
 * mission and its opponent - a training dummy or the easy computer - won
 * by the level's rule like any
 * other - holding the zone, eating pellets, the bigger colony when the
 * clock runs out - and, where the mission asks for more, with what the
 * match measured: the boosts fired.
 *
 * A mission is done once, on the day it was done, and stays done; it may
 * be played again. Missions keep no medallion and count for no totals or
 * achievements - what a done mission is worth is its XP (`xp.ts`).
 */
export interface Mission {
  id: MissionId;
  /** The level it is played on. */
  levelId: string;
  /** The icon of its card. */
  icon: string;
  /** Boosts it asks to fire on the way, none when absent. */
  boosts?: number;
}

export const MISSIONS: readonly Mission[] = [
  { id: 'steer', levelId: 'training-steer', icon: 'open_with' },
  { id: 'feed', levelId: 'training-feed', icon: 'restaurant' },
  { id: 'boost', levelId: 'training-boost', icon: 'bolt', boosts: 2 },
  { id: 'attack', levelId: 'training-attack', icon: 'sports_mma' },
  { id: 'fight', levelId: 'training-fight', icon: 'smart_toy' },
];

/** The mission with that id. */
export function missionById(id: MissionId): Mission {
  return MISSIONS[MISSION_IDS.indexOf(id)];
}

/** The mission a level is played for, null for any other level. */
export function missionOf(levelId: string): Mission | null {
  const id = getLevel(levelId).mission;
  return id === undefined ? null : missionById(id);
}

/** The mission after this one, null after the last. */
export function nextMission(id: MissionId): Mission | null {
  return MISSIONS[MISSION_IDS.indexOf(id) + 1] ?? null;
}

/** The day each mission was done - the progress's `training`. */
type MissionDays = Progress['training'];

/** True once the mission has been done. */
export function isMissionDone(days: MissionDays, id: MissionId): boolean {
  return days[id] != null;
}

/** The missions done so far. */
export function missionsDone(days: MissionDays): number {
  return MISSION_IDS.filter((id) => isMissionDone(days, id)).length;
}

/** The first mission still to do - the first one again once all are done. */
export function firstOpenMission(days: MissionDays): MissionId {
  return MISSION_IDS.find((id) => !isMissionDone(days, id)) ?? 'steer';
}

/**
 * What a match left the mission short of - null once it did the mission:
 * a win, and the boosts it asks for.
 */
export function missionShortfall(
  mission: Mission,
  record: MatchRecord
): GameText | null {
  if (!record.won) {
    return { key: `training.missions.${mission.id}.goal` };
  }
  if (mission.boosts !== undefined && record.boostsFired < mission.boosts) {
    return {
      key: 'training.result.boosts',
      params: { count: mission.boosts, fired: record.boostsFired },
    };
  }
  return null;
}

/**
 * The progress with a mission done on `day` - the earlier day kept, so
 * tabs and devices converge. Without a change it is the progress given.
 */
export function addMission(
  progress: Progress,
  id: MissionId,
  day: string
): Progress {
  const training = earlierDays(progress.training, { [id]: day });
  return training === null ? progress : { ...progress, training };
}

/** What a mission's match came to, for the result screen. */
export interface MissionResult {
  /** What the match left the mission short of, null once it did it. */
  shortfall: GameText | null;
  /** True when it did the mission for the first time. */
  first: boolean;
  /** True once every mission is done - in whatever order. */
  allDone: boolean;
  /**
   * Where the training goes on after a mission done: the mission after it,
   * else the first still to do - null after a match short of it, or once
   * every mission is done.
   */
  next: MissionId | null;
}

/** Where the training stands after a mission's match, done or not. */
export function missionResult(
  id: MissionId,
  shortfall: GameText | null,
  first: boolean,
  days: MissionDays
): MissionResult {
  const allDone = missionsDone(days) === MISSION_IDS.length;
  return {
    shortfall,
    first,
    allDone,
    next:
      shortfall !== null || allDone
        ? null
        : (nextMission(id)?.id ?? firstOpenMission(days)),
  };
}
